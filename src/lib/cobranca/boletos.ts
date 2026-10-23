// Régua de cobrança — Fase 2: boleto + QR Code Pix do Banco Inter por parcela
// (0062). O boleto é emitido na hora do ENVIO do e-mail de cobrança (não na
// geração da régua): um envio descartado na aprovação nunca deixa cobrança
// órfã no Inter. Situação de cada boleto: webhook do Inter
// (/api/webhooks/inter) e conferência diária no cron da régua — sempre
// relendo a cobrança na API, nunca confiando só no aviso.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CobrancaBoletoRow, CobrancaConfiguracaoRow, Database } from "@/lib/supabase/database.types";
import { buscarDetalheContatoBling } from "@/lib/integracoes/bling";
import { consultarCobrancaInter, emitirCobrancaInter, interConfigurado, pdfCobrancaInter, type CobrancaInter } from "@/lib/integracoes/inter";

type Supa = SupabaseClient<Database>;

/** Situações em que o boleto ainda vale (pode ser pago). */
export const SITUACOES_BOLETO_VALIDO = ["A_RECEBER", "ATRASADO", "EM_PROCESSAMENTO"];
/** Pago no Inter — a régua não cobra mais a parcela, mesmo antes da baixa no Bling. */
export const SITUACOES_BOLETO_PAGO = ["RECEBIDO", "MARCADO_RECEBIDO"];

/** O que falta para a emissão pelo Inter poder ser ligada (vazio = pronta). */
export function pendenciasEmissaoInter(config: CobrancaConfiguracaoRow): string[] {
  const faltam: string[] = [];
  if (!interConfigurado()) faltam.push("credenciais do Banco Inter nas variáveis de ambiente");
  if (config.inter_multa_percentual === null) faltam.push("percentual de multa (0 = sem multa)");
  if (config.inter_juros_mensal_percentual === null) faltam.push("percentual de juros ao mês (0 = sem juros)");
  if (!config.inter_data_corte) faltam.push("data de corte da emissão");
  return faltam;
}

export async function boletosDasParcelas(supabase: Supa, parcelaIds: number[]): Promise<Map<number, CobrancaBoletoRow>> {
  if (!parcelaIds.length) return new Map();
  const { data } = await supabase.from("cobranca_boletos").select("*").in("parcela_id", parcelaIds).order("emitido_em", { ascending: false });
  // O mais recente de cada parcela (válido ou pago vem antes de cancelado/expirado na prática, por data).
  const porParcela = new Map<number, CobrancaBoletoRow>();
  for (const b of data ?? []) if (!porParcela.has(b.parcela_id)) porParcela.set(b.parcela_id, b);
  return porParcela;
}

function camposDaCobranca(c: CobrancaInter) {
  return {
    situacao: c.situacao,
    nosso_numero: c.nossoNumero,
    linha_digitavel: c.linhaDigitavel,
    codigo_barras: c.codigoBarras,
    pix_copia_e_cola: c.pixCopiaECola,
    txid: c.txid,
    valor_recebido: c.valorTotalRecebido,
    recebido_em: SITUACOES_BOLETO_PAGO.includes(c.situacao) ? c.dataSituacao : null,
    origem_recebimento: c.origemRecebimento,
    atualizado_em: new Date().toISOString(),
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Boleto válido da parcela — emite no Inter se ainda não houver. A emissão é
 * assíncrona no Inter: a linha digitável e o Pix chegam na consulta, que é
 * repetida por alguns segundos. A trava de 0062 (um válido por parcela)
 * impede emitir em duplicidade.
 */
export async function garantirBoleto(
  supabase: Supa,
  config: CobrancaConfiguracaoRow,
  parcela: { parcela_id: number; contato_id: number; bling_pedido_id: number | null; vencimento: string; valor: number; rotulo: string },
  emitidoPor?: string,
): Promise<CobrancaBoletoRow> {
  const existente = (await boletosDasParcelas(supabase, [parcela.parcela_id])).get(parcela.parcela_id);
  if (existente && (SITUACOES_BOLETO_VALIDO.includes(existente.situacao) || SITUACOES_BOLETO_PAGO.includes(existente.situacao))) {
    return existente.linha_digitavel ? existente : await atualizarBoleto(supabase, existente.codigo_solicitacao);
  }

  const contato = await buscarDetalheContatoBling(supabase, parcela.contato_id);
  if (!contato) throw new Error("Não foi possível ler o cadastro do cliente no Bling para emitir o boleto.");
  const faltando = [!contato.endereco && "endereço", !contato.cep && "CEP", !contato.municipio && "cidade", !contato.uf && "UF", !contato.cnpj && "CPF/CNPJ"].filter(Boolean);
  if (faltando.length) throw new Error(`Cadastro do cliente no Bling incompleto para o boleto: falta ${faltando.join(", ")}.`);

  const codigo = await emitirCobrancaInter({
    seuNumero: String(parcela.parcela_id),
    valorNominal: parcela.valor,
    dataVencimento: parcela.vencimento,
    numDiasAgenda: config.inter_dias_validade,
    pagador: {
      cpfCnpj: contato.cnpj,
      tipoPessoa: contato.cnpj.length === 11 ? "FISICA" : "JURIDICA",
      nome: contato.nome,
      endereco: contato.endereco!,
      numero: contato.numero ?? undefined,
      complemento: contato.complemento ?? undefined,
      bairro: contato.bairro ?? undefined,
      cidade: contato.municipio!,
      uf: contato.uf!,
      cep: contato.cep!,
    },
    multaPercentual: Number(config.inter_multa_percentual) || null,
    jurosMensalPercentual: Number(config.inter_juros_mensal_percentual) || null,
    mensagem: [`Footlink · ${parcela.rotulo}`],
  });
  const { data: linha, error } = await supabase
    .from("cobranca_boletos")
    .insert({
      parcela_id: parcela.parcela_id,
      contato_id: parcela.contato_id,
      bling_pedido_id: parcela.bling_pedido_id,
      origem: "sistema",
      codigo_solicitacao: codigo,
      seu_numero: String(parcela.parcela_id),
      valor: parcela.valor,
      vencimento: parcela.vencimento,
      situacao: "EM_PROCESSAMENTO",
      emitido_por: emitidoPor ?? null,
    })
    .select("*")
    .single();
  if (error || !linha) throw new Error(`Boleto emitido no Inter (${codigo}), mas falhou ao registrar: ${error?.message}`);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const atual = await atualizarBoleto(supabase, codigo);
    if (atual.linha_digitavel && atual.pix_copia_e_cola) return atual;
    await esperar(2000);
  }
  throw new Error("O Inter ainda está processando o boleto — tente enviar de novo em alguns minutos.");
}

/** Relê a cobrança no Inter e atualiza o registro. */
export async function atualizarBoleto(supabase: Supa, codigoSolicitacao: string): Promise<CobrancaBoletoRow> {
  const c = await consultarCobrancaInter(codigoSolicitacao);
  const { data, error } = await supabase.from("cobranca_boletos").update(camposDaCobranca(c)).eq("codigo_solicitacao", codigoSolicitacao).select("*").single();
  if (error || !data) throw new Error(`Falha ao atualizar o boleto ${codigoSolicitacao}: ${error?.message}`);
  return data;
}

/** Conferência diária: relê no Inter os boletos ainda em aberto (caso algum aviso do webhook se perca). */
export async function conferirBoletosAbertos(supabase: Supa): Promise<{ conferidos: number; pagos: number; falhas: number }> {
  const r = { conferidos: 0, pagos: 0, falhas: 0 };
  if (!interConfigurado()) return r;
  const { data } = await supabase.from("cobranca_boletos").select("codigo_solicitacao").in("situacao", SITUACOES_BOLETO_VALIDO).eq("teste", false);
  for (const b of data ?? []) {
    try {
      const atual = await atualizarBoleto(supabase, b.codigo_solicitacao);
      r.conferidos++;
      if (SITUACOES_BOLETO_PAGO.includes(atual.situacao)) r.pagos++;
    } catch (e) {
      r.falhas++;
      console.error(`[cobranca] conferência do boleto ${b.codigo_solicitacao}:`, e instanceof Error ? e.message : e);
    }
  }
  return r;
}

/** PDFs dos boletos para anexar ao e-mail de cobrança. */
export async function pdfsDosBoletos(boletos: CobrancaBoletoRow[]): Promise<{ nome: string; base64: string }[]> {
  const anexos: { nome: string; base64: string }[] = [];
  for (const b of boletos) anexos.push({ nome: `boleto-footlink-${b.vencimento}.pdf`, base64: await pdfCobrancaInter(b.codigo_solicitacao) });
  return anexos;
}

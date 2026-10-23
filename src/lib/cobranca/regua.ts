// Régua de cobrança do Footlink — F1 (0058). O cron diário (/api/cron/cobranca,
// 9h BRT, depois da sincronização do Bling das 7h) gera os envios do dia; no
// modo "aprovacao" eles esperam a Diretoria em /financeiro/cobranca, no modo
// "automatico" saem na hora. Antes de cada envio a parcela é conferida ao vivo
// no Bling: baixa feita depois da sincronização cancela o envio.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CobrancaConfiguracaoRow, CobrancaEnvioItemRow, CobrancaEnvioRow, Database, EntregaEnvioCobranca } from "@/lib/supabase/database.types";
import { carregarBaseParcelas } from "@/lib/financeiro/carteira";
import { consultarBling, obterAccessTokenValido, pedidoBlingCancelado } from "@/lib/integracoes/bling";
import { enderecoRemetentePadrao, enviarEmailResend } from "@/lib/integracoes/resend";
import { montarEmailCliente, montarEmailEscalonamento, type EmailCobrancaMontado, type ItemEmailCobranca } from "./emailCobranca";
import { SITUACOES_BOLETO_PAGO, SITUACOES_BOLETO_VALIDO, boletosDasParcelas, cancelarBoletosDasParcelas, conferirBoletosAbertos, garantirBoleto, pdfsDosBoletos, pendenciasEmissaoInter } from "./boletos";
import { JANELA_RECUPERACAO_DIAS, dataEnvioCobranca, diasDesdeVencimento, etapaDoDia, hojeBrt, normalizarEmails, tipoDoEnvio } from "./regras";

type Supa = SupabaseClient<Database>;

/** O escalonamento usa etapa = 1000 + dias, para não colidir com uma etapa da régua no mesmo dia (chave parcela × etapa). */
export const ETAPA_ESCALONAMENTO_BASE = 1000;
/** Cobrança avulsa de parcela fora da régua ("Cobrar atrasados"): uma vez por parcela. */
export const ETAPA_COBRANCA_AVULSA = 500;
/** Envio do boleto + Pix do Inter (F2), na antecedência configurada: uma vez por parcela. */
export const ETAPA_COBRANCA_BOLETO = 700;
/** E-mails do contato no Bling são relidos depois disso. */
const VALIDADE_EMAILS_BLING_MS = 7 * 86_400_000;
/** Situações de conta a receber no Bling que encerram a cobrança: recebida, devolvida, cancelada. */
const SITUACOES_ENCERRADAS = new Set([2, 4, 5]);

async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await consulta(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function carregarConfiguracaoCobranca(supabase: Supa): Promise<CobrancaConfiguracaoRow> {
  const { data, error } = await supabase.from("cobranca_configuracao").select("*").eq("id", true).single();
  if (error || !data) throw new Error(`Configuração da régua de cobrança não encontrada (migration 0058): ${error?.message ?? ""}`);
  return data;
}

/**
 * Token do Bling sem disputar a renovação com a sincronização: o Bling
 * invalida o refresh_token anterior a cada renovação (ver 0053). Token ainda
 * válido é usado direto; vencido, só renova se não houver sincronização
 * rodando. null = seguir só com o cache.
 */
async function tokenBlingSeguro(supabase: Supa): Promise<string | null> {
  const { data } = await supabase.from("integracoes_bling").select("access_token, expires_at").limit(1).maybeSingle();
  if (!data?.access_token) return null;
  if (data.expires_at && Date.parse(data.expires_at) - 60_000 > Date.now()) return data.access_token;
  // "Rodando" há mais de 10 min é execução morta (a função tem limite de 5 min) — não bloqueia.
  const { data: rodando } = await supabase
    .from("bling_sync_execucoes")
    .select("id")
    .eq("status", "rodando")
    .gt("iniciado_em", new Date(Date.now() - 10 * 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (rodando) return null;
  try {
    return await obterAccessTokenValido(supabase);
  } catch {
    return null;
  }
}

/** Nome exibido do cliente: cadastro local (fantasia/razão social) ou o nome do contato no Bling. */
async function nomeDoCliente(supabase: Supa, contatoId: number): Promise<string> {
  const [{ data: local }, { data: contato }] = await Promise.all([
    supabase.from("clientes").select("nome_fantasia, razao_social").eq("bling_contato_id", contatoId).maybeSingle(),
    supabase.from("bling_contatos").select("nome").eq("id", contatoId).maybeSingle(),
  ]);
  return local?.nome_fantasia || local?.razao_social || contato?.nome || "Cliente";
}

export type OrigemDestinatarios = "pedido" | "contato";

/** E-mails escritos nas observações internas do pedido ("E-mail financeiro: …"). */
export function emailsDoTexto(texto: string | null | undefined): string[] {
  return normalizarEmails(texto?.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []);
}

/** E-mails das observações internas de cada pedido (cache em cobranca_pedidos_emails, relido a cada 7 dias). */
async function emailsDosPedidos(supabase: Supa, pedidoIds: number[], token: string | null, forcar: boolean): Promise<string[]> {
  if (!pedidoIds.length) return [];
  const { data: cache } = await supabase.from("cobranca_pedidos_emails").select("*").in("bling_pedido_id", pedidoIds);
  const porPedido = new Map((cache ?? []).map((c) => [c.bling_pedido_id, c]));
  const emails: string[] = [];
  for (const id of pedidoIds) {
    const atual = porPedido.get(id);
    const vencido = forcar || !atual || Date.now() - Date.parse(atual.buscados_em) > VALIDADE_EMAILS_BLING_MS;
    if (vencido && token) {
      try {
        const { data } = await consultarBling<{ data: { observacoesInternas?: string } }>(token, `/pedidos/vendas/${id}`);
        const lidos = emailsDoTexto(data.observacoesInternas);
        await supabase.from("cobranca_pedidos_emails").upsert({ bling_pedido_id: id, emails: lidos, buscados_em: new Date().toISOString() });
        emails.push(...lidos);
        continue;
      } catch (e) {
        console.error(`[cobranca] observações do pedido ${id} no Bling:`, e instanceof Error ? e.message : e);
      }
    }
    emails.push(...(atual?.emails ?? []));
  }
  // Pedidos criados pela plataforma: os mesmos e-mails, gravados também aqui (0040).
  const { data: locais } = await supabase.from("pedidos").select("emails_financeiro").in("bling_pedido_id", pedidoIds.map(String));
  return normalizarEmails(emails, ...(locais ?? []).map((p) => p.emails_financeiro));
}

/**
 * Destinatários de uma cobrança. Prioridade: os e-mails que o financeiro anota
 * nas observações internas dos pedidos de venda das parcelas; sem nenhum, o
 * e-mail e o e-mail de nota fiscal do contato no Bling (cache em
 * cobranca_clientes, relido a cada 7 dias). Os destinatários extras da régua
 * entram sempre.
 */
export async function destinatariosDaCobranca(
  supabase: Supa,
  contatoId: number,
  pedidoIds: number[],
  token: string | null,
  forcar = false,
): Promise<{ emails: string[]; origem: OrigemDestinatarios }> {
  let { data: regra } = await supabase.from("cobranca_clientes").select("*").eq("contato_id", contatoId).maybeSingle();
  const doPedido = await emailsDosPedidos(supabase, [...new Set(pedidoIds)], token, forcar);
  const extras = regra?.destinatarios_extra ?? [];
  if (doPedido.length) return { emails: normalizarEmails(doPedido, extras), origem: "pedido" };

  const vencido = forcar || !regra?.emails_buscados_em || Date.now() - Date.parse(regra.emails_buscados_em) > VALIDADE_EMAILS_BLING_MS;
  if (vencido && token) {
    try {
      const { data } = await consultarBling<{ data: { email?: string; emailNotaFiscal?: string } }>(token, `/contatos/${contatoId}`);
      const atualizado = { contato_id: contatoId, email_bling: data.email?.trim() || null, email_nf_bling: data.emailNotaFiscal?.trim() || null, emails_buscados_em: new Date().toISOString() };
      await supabase.from("cobranca_clientes").upsert(atualizado);
      regra = {
        ...(regra ?? { pausada: false, motivo_pausa: null, regua_dias: null, destinatarios_extra: [], cobranca_antecedencia_dias: null, cobranca_dia_mes: null, atualizado_em: "", atualizado_por: null }),
        ...atualizado,
      };
    } catch (e) {
      console.error(`[cobranca] e-mails do contato ${contatoId} no Bling:`, e instanceof Error ? e.message : e);
    }
  }
  return { emails: normalizarEmails(regra?.email_bling, regra?.email_nf_bling, extras), origem: "contato" };
}

export interface ResumoGeracao {
  ignorado?: string;
  clientes: number;
  escalonamentos: number;
  semEmail: number;
  enviados: number;
  falhas: number;
}

/**
 * Gera os envios do dia: para cada parcela em aberto (vencimento a partir da
 * data de corte, cliente não pausado), a etapa da régua que vence hoje; um
 * e-mail por cliente reunindo as parcelas. Escalonamento: um aviso interno
 * por cliente cuja parcela chega ao dia de escalonamento.
 */
export async function gerarEnviosDoDia(supabase: Supa, hoje = hojeBrt()): Promise<ResumoGeracao> {
  const resumo: ResumoGeracao = { clientes: 0, escalonamentos: 0, semEmail: 0, enviados: 0, falhas: 0 };
  const config = await carregarConfiguracaoCobranca(supabase);
  if (config.modo === "desligado") return { ...resumo, ignorado: "A régua está desligada." };
  if (!config.data_corte) return { ...resumo, ignorado: "Defina a data de corte antes de ligar a régua." };

  // Envio não aprovado a tempo expira: a etapa seguinte da régua assume (um lembrete velho não sai atrasado).
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) - JANELA_RECUPERACAO_DIAS * 86_400_000).toISOString().slice(0, 10);
  await supabase.from("cobranca_envios").update({ status: "descartado", erro: "Expirou sem aprovação." }).eq("status", "pendente").lt("data_prevista", limite);

  const [base, regras, itens] = await Promise.all([
    carregarBaseParcelas(supabase),
    lerTudo((de, ate) => supabase.from("cobranca_clientes").select("contato_id, pausada, regua_dias, cobranca_antecedencia_dias, cobranca_dia_mes").range(de, ate)),
    lerTudo((de, ate) => supabase.from("cobranca_envio_itens").select("parcela_id, etapa").range(de, ate)),
  ]);
  const regraDe = new Map(regras.map((r) => [r.contato_id, r]));
  const enviadas = new Map<number, Set<number>>();
  for (const i of itens) enviadas.set(i.parcela_id, (enviadas.get(i.parcela_id) ?? new Set()).add(i.etapa));

  // F2: situação dos boletos do Inter (webhook pode ter falhado) e parcelas já pagas pelo boleto — a régua não cobra
  // essas, mesmo antes da baixa no Bling.
  await conferirBoletosAbertos(supabase);
  const pagasNoBoleto = new Set(
    (await lerTudo((de, ate) => supabase.from("cobranca_boletos").select("parcela_id").in("situacao", SITUACOES_BOLETO_PAGO).range(de, ate))).map((b) => b.parcela_id),
  );
  const emissaoInter = config.inter_emissao_ativa && pendenciasEmissaoInter(config).length === 0 ? config.inter_data_corte : null;

  type Item = Omit<CobrancaEnvioItemRow, "envio_id">;
  const paraCobrar = new Map<number, Item[]>();
  const paraCliente = new Map<number, Item[]>();
  const paraEscalonar = new Map<number, Item[]>();
  const etapaEscalonamento = ETAPA_ESCALONAMENTO_BASE + config.escalonamento_dias;
  for (const p of base.parcelas) {
    if ((p.situacao !== "em_aberto" && p.situacao !== "atrasada") || base.deCancelado(p) || p.vencimento < config.data_corte) continue;
    const regra = regraDe.get(p.contatoId);
    if (regra?.pausada || pagasNoBoleto.has(p.id)) continue;
    const dias = diasDesdeVencimento(p.vencimento, hoje);
    const jaEnviadas = enviadas.get(p.id) ?? new Set<number>();
    const item = (etapa: number): Item => ({
      parcela_id: p.id,
      bling_pedido_id: p.numeroPedidoOrigem ? (base.pedidoPorChave.get(`${p.contatoId}:${p.numeroPedidoOrigem}`)?.id ?? null) : null,
      etapa,
      vencimento: p.vencimento,
      valor: p.valor,
      rotulo: `Parcela ${p.numero}/${p.totalDoPedido}${p.numeroPedidoOrigem ? ` · pedido ${p.numeroPedidoOrigem}` : ""}`,
    });
    // Boleto + Pix na janela do cliente (padrão: D-10; ou antecedência própria; ou "até o dia X do mês"),
    // a partir da data de corte da F2 e sempre antes do vencimento.
    const envioCobranca = dataEnvioCobranca(p.vencimento, regra?.cobranca_antecedencia_dias ?? config.inter_antecedencia_dias, regra?.cobranca_dia_mes ?? null);
    const diasCobranca = diasDesdeVencimento(envioCobranca, hoje);
    if (emissaoInter && p.vencimento >= emissaoInter && dias < 0 && diasCobranca >= 0 && diasCobranca <= JANELA_RECUPERACAO_DIAS && !jaEnviadas.has(ETAPA_COBRANCA_BOLETO)) {
      paraCobrar.set(p.contatoId, [...(paraCobrar.get(p.contatoId) ?? []), item(ETAPA_COBRANCA_BOLETO)]);
    }
    const etapa = etapaDoDia(regra?.regua_dias ?? config.regua_dias, dias, jaEnviadas);
    if (etapa !== null) paraCliente.set(p.contatoId, [...(paraCliente.get(p.contatoId) ?? []), item(etapa)]);
    const diasEsc = dias - config.escalonamento_dias;
    if (config.emails_escalonamento.length && diasEsc >= 0 && diasEsc <= JANELA_RECUPERACAO_DIAS && !jaEnviadas.has(etapaEscalonamento)) {
      paraEscalonar.set(p.contatoId, [...(paraEscalonar.get(p.contatoId) ?? []), item(etapaEscalonamento)]);
    }
  }

  const token = paraCliente.size || paraCobrar.size ? await tokenBlingSeguro(supabase) : null;
  const criados: { id: string; interno: boolean }[] = [];
  async function criar(contatoId: number, tipo: CobrancaEnvioRow["tipo"], itensEnvio: Item[], destinatarios: string[]) {
    const { data: envio, error } = await supabase
      .from("cobranca_envios")
      .insert({
        contato_id: contatoId,
        tipo,
        data_prevista: hoje,
        destinatarios,
        teste: !!config.email_teste,
        status: destinatarios.length ? "pendente" : "erro",
        erro: destinatarios.length ? null : "Cliente sem e-mail válido no Bling e sem destinatários extras na régua.",
      })
      .select("id")
      .single();
    if (error || !envio) throw new Error(`Falha ao registrar envio da régua: ${error?.message}`);
    const { error: erroItens } = await supabase.from("cobranca_envio_itens").insert(itensEnvio.map((i) => ({ ...i, envio_id: envio.id })));
    if (erroItens) {
      // Etapa já registrada por outra execução (chave parcela × etapa): descarta este envio.
      await supabase.from("cobranca_envios").delete().eq("id", envio.id);
      if (erroItens.code === "23505") return;
      throw new Error(`Falha ao registrar parcelas do envio: ${erroItens.message}`);
    }
    if (destinatarios.length) criados.push({ id: envio.id, interno: tipo === "escalonamento" });
    else resumo.semEmail++;
  }

  for (const [contatoId, itensCobranca] of paraCobrar) {
    const { emails } = await destinatariosDaCobranca(supabase, contatoId, pedidosDe(itensCobranca), token);
    await criar(contatoId, "cobranca", itensCobranca, emails);
    resumo.clientes++;
  }
  for (const [contatoId, itensCliente] of paraCliente) {
    const { emails } = await destinatariosDaCobranca(supabase, contatoId, pedidosDe(itensCliente), token);
    await criar(contatoId, tipoDoEnvio(itensCliente.map((i) => i.etapa)), itensCliente, emails);
    resumo.clientes++;
  }
  for (const [contatoId, itensEsc] of paraEscalonar) {
    await criar(contatoId, "escalonamento", itensEsc, normalizarEmails(config.emails_escalonamento));
    resumo.escalonamentos++;
  }

  // Aviso interno sai sempre; os e-mails ao cliente só sem aprovação.
  for (const c of criados) {
    if (!c.interno && config.modo !== "automatico") continue;
    const status = await enviarEnvio(supabase, c.id);
    if (status === "enviado") resumo.enviados++;
    else if (status === "erro") resumo.falhas++;
  }
  return resumo;
}

const pedidosDe = (itens: { bling_pedido_id: number | null }[]) => itens.map((i) => i.bling_pedido_id).filter((id): id is number => id !== null);

type EnvioComItens = CobrancaEnvioRow & { itens: CobrancaEnvioItemRow[] };

/** Lembrete e aviso de vencimento: cliente com parcela a vencer — as pendências entram sem a data de corte. */
const temParcelaAVencer = (envio: Pick<CobrancaEnvioRow, "tipo">) => envio.tipo === "cobranca" || envio.tipo === "lembrete" || envio.tipo === "vencimento";

export interface ClienteAtrasadoForaDaRegua {
  contatoId: number;
  cliente: string;
  parcelas: number;
  total: number;
  maiorAtraso: number;
}

/**
 * "Cobrar atrasados": clientes com parcela vencida FORA da régua — depois da
 * última etapa e da janela de recuperação (D+15 com a régua padrão), que a
 * régua já não alcança — e com vencimento a partir da data de corte (evita
 * clientes muito atrasados, sem contrato ativo). Cliente pausado e pedido
 * cancelado ficam fora; cada parcela recebe essa cobrança uma única vez.
 * `simular`: só devolve a lista (a janela de confirmação da tela). Senão, cria
 * os envios sempre pendentes de aprovação, mesmo com a régua no automático.
 */
export async function cobrarAtrasadosForaDaRegua(
  supabase: Supa,
  opcoes: { simular: boolean; /** Só simulação: outra data de corte, sem alterar a configuração gravada. */ dataCorte?: string },
  hoje = hojeBrt(),
): Promise<ClienteAtrasadoForaDaRegua[]> {
  const gravada = await carregarConfiguracaoCobranca(supabase);
  const config = opcoes.simular && opcoes.dataCorte ? { ...gravada, data_corte: opcoes.dataCorte } : gravada;
  if (!config.data_corte) throw new Error("Defina a data de corte antes de cobrar os atrasados.");
  const limite = Math.max(...config.regua_dias) + JANELA_RECUPERACAO_DIAS;
  const [base, regras, itens] = await Promise.all([
    carregarBaseParcelas(supabase),
    lerTudo((de, ate) => supabase.from("cobranca_clientes").select("contato_id, pausada").range(de, ate)),
    lerTudo((de, ate) => supabase.from("cobranca_envio_itens").select("parcela_id").eq("etapa", ETAPA_COBRANCA_AVULSA).range(de, ate)),
  ]);
  const pausados = new Set(regras.filter((r) => r.pausada).map((r) => r.contato_id));
  const pagasNoBoleto = new Set(
    (await lerTudo((de, ate) => supabase.from("cobranca_boletos").select("parcela_id").in("situacao", SITUACOES_BOLETO_PAGO).range(de, ate))).map((b) => b.parcela_id),
  );
  const jaCobradas = new Set(itens.map((i) => i.parcela_id));

  type Item = Omit<CobrancaEnvioItemRow, "envio_id">;
  const porCliente = new Map<number, { itens: Item[]; maiorAtraso: number }>();
  for (const p of base.parcelas) {
    if ((p.situacao !== "em_aberto" && p.situacao !== "atrasada") || base.deCancelado(p)) continue;
    if (p.vencimento < config.data_corte || pausados.has(p.contatoId) || jaCobradas.has(p.id) || pagasNoBoleto.has(p.id)) continue;
    const dias = diasDesdeVencimento(p.vencimento, hoje);
    if (dias <= limite) continue;
    const c = porCliente.get(p.contatoId) ?? { itens: [], maiorAtraso: 0 };
    c.itens.push({
      parcela_id: p.id,
      etapa: ETAPA_COBRANCA_AVULSA,
      vencimento: p.vencimento,
      valor: p.valor,
      rotulo: `Parcela ${p.numero}/${p.totalDoPedido}${p.numeroPedidoOrigem ? ` · pedido ${p.numeroPedidoOrigem}` : ""}`,
      bling_pedido_id: p.numeroPedidoOrigem ? (base.pedidoPorChave.get(`${p.contatoId}:${p.numeroPedidoOrigem}`)?.id ?? null) : null,
    });
    c.maiorAtraso = Math.max(c.maiorAtraso, dias);
    porCliente.set(p.contatoId, c);
  }

  const lista = [...porCliente].map(([contatoId, c]) => ({
    contatoId,
    cliente: base.nomeDoContato(contatoId),
    parcelas: c.itens.length,
    total: c.itens.reduce((s, i) => s + i.valor, 0),
    maiorAtraso: c.maiorAtraso,
  }));
  if (opcoes.simular) return lista.sort((a, b) => b.maiorAtraso - a.maiorAtraso);

  const token = porCliente.size ? await tokenBlingSeguro(supabase) : null;
  for (const [contatoId, c] of porCliente) {
    const { emails } = await destinatariosDaCobranca(supabase, contatoId, pedidosDe(c.itens), token);
    const { data: envio, error } = await supabase
      .from("cobranca_envios")
      .insert({
        contato_id: contatoId,
        tipo: "atraso",
        data_prevista: hoje,
        destinatarios: emails,
        teste: !!config.email_teste,
        status: emails.length ? "pendente" : "erro",
        erro: emails.length ? null : "Cliente sem e-mail válido no Bling e sem destinatários extras na régua.",
      })
      .select("id")
      .single();
    if (error || !envio) throw new Error(`Falha ao registrar a cobrança de ${base.nomeDoContato(contatoId)}: ${error?.message}`);
    const { error: erroItens } = await supabase.from("cobranca_envio_itens").insert(c.itens.map((i) => ({ ...i, envio_id: envio.id })));
    if (erroItens) {
      await supabase.from("cobranca_envios").delete().eq("id", envio.id);
      if (erroItens.code !== "23505") throw new Error(`Falha ao registrar as parcelas de ${base.nomeDoContato(contatoId)}: ${erroItens.message}`);
    }
  }
  return lista;
}

async function carregarEnvio(supabase: Supa, envioId: string): Promise<EnvioComItens> {
  const [{ data: envio }, { data: itens }] = await Promise.all([
    supabase.from("cobranca_envios").select("*").eq("id", envioId).single(),
    supabase.from("cobranca_envio_itens").select("*").eq("envio_id", envioId).order("vencimento"),
  ]);
  if (!envio) throw new Error("Envio não encontrado.");
  return { ...envio, itens: itens ?? [] };
}

/** Monta o e-mail de um envio (também usado na pré-visualização da tela). */
export interface ParcelaVencida {
  parcela_id: number;
  vencimento: string;
  valor: number;
  rotulo: string;
}

/**
 * Outras parcelas do cliente vencidas e não pagas, que o e-mail lista junto com
 * as da etapa do dia. Vencimento entre a data de corte e ontem — exceto no
 * lembrete e no aviso de vencimento (cliente com parcela a vencer, logo com
 * contrato ativo), que trazem TODAS as vencidas, sem o corte. Numeração
 * n/N como na carteira: ordem de vencimento dentro de cada pedido. Parcelas de
 * pedido cancelado no Bling ficam fora.
 */
export async function parcelasVencidasDoCliente(
  supabase: Supa,
  contatoId: number,
  config: CobrancaConfiguracaoRow,
  excluir: Set<number>,
  hoje = hojeBrt(),
  semCorte = false,
): Promise<ParcelaVencida[]> {
  const [{ data: parcelas }, { data: pedidos }] = await Promise.all([
    supabase.from("bling_parcelas").select("id, numero_pedido_origem, vencimento, valor, situacao").eq("contato_id", contatoId).order("vencimento"),
    supabase.from("bling_pedidos").select("numero, situacao_id, situacao_valor").eq("contato_id", contatoId),
  ]);
  const cancelados = new Set((pedidos ?? []).filter((p) => pedidoBlingCancelado(p.situacao_id, p.situacao_valor)).map((p) => p.numero));
  const porPedido = new Map<string, NonNullable<typeof parcelas>>();
  for (const p of parcelas ?? []) {
    const chave = p.numero_pedido_origem ?? "avulsa";
    porPedido.set(chave, [...(porPedido.get(chave) ?? []), p]);
  }
  const vencidas: ParcelaVencida[] = [];
  for (const [pedido, grupo] of porPedido) {
    if (cancelados.has(pedido)) continue;
    grupo.forEach((p, i) => {
      if (excluir.has(p.id) || SITUACOES_ENCERRADAS.has(p.situacao) || p.situacao === 3) return;
      if (p.vencimento >= hoje || (!semCorte && config.data_corte && p.vencimento < config.data_corte)) return;
      vencidas.push({ parcela_id: p.id, vencimento: p.vencimento, valor: Number(p.valor), rotulo: `Parcela ${i + 1}/${grupo.length}${pedido !== "avulsa" ? ` · pedido ${pedido}` : ""}` });
    });
  }
  return vencidas;
}

/** Monta o e-mail de um envio (também usado na pré-visualização). `vencidas`: as demais parcelas em atraso do cliente (sem, são buscadas no cache). */
export async function montarEmailDoEnvio(
  supabase: Supa,
  envio: EnvioComItens,
  config: CobrancaConfiguracaoRow,
  hoje = hojeBrt(),
  vencidas?: ParcelaVencida[],
  /** Dados de pagamento por parcela; sem, vêm dos boletos válidos já emitidos (a cobrança sem boleto mostra o lugar dele). */
  pagamentos?: Map<number, ItemEmailCobranca["pagamento"]>,
): Promise<EmailCobrancaMontado> {
  const nomeCliente = await nomeDoCliente(supabase, envio.contato_id);
  const outras = vencidas ?? (await parcelasVencidasDoCliente(supabase, envio.contato_id, config, new Set(envio.itens.map((i) => i.parcela_id)), hoje, temParcelaAVencer(envio)));
  const todas = [...envio.itens, ...outras];
  const pagamentoDe = pagamentos ?? (await pagamentosDosBoletos(supabase, todas.map((i) => i.parcela_id), envio.tipo === "cobranca" ? envio.itens.map((i) => i.parcela_id) : []));
  const itens = todas
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((i) => ({ rotulo: i.rotulo, vencimento: i.vencimento, valor: Number(i.valor), dias: diasDesdeVencimento(i.vencimento, hoje), pagamento: pagamentoDe.get(i.parcela_id) ?? null }));
  if (envio.tipo === "escalonamento") return montarEmailEscalonamento({ nomeCliente, itens, contatoId: envio.contato_id });
  return montarEmailCliente({ tipo: envio.tipo, nomeCliente, itens, chavePix: config.chave_pix });
}

/** Linha digitável e Pix dos boletos válidos das parcelas; `aEmitir` (cobrança ainda sem boleto) mostra o lugar do boleto. */
async function pagamentosDosBoletos(supabase: Supa, parcelaIds: number[], aEmitir: number[]): Promise<Map<number, ItemEmailCobranca["pagamento"]>> {
  const boletos = await boletosDasParcelas(supabase, parcelaIds);
  const mapa = new Map<number, ItemEmailCobranca["pagamento"]>();
  for (const id of parcelaIds) {
    const b = boletos.get(id);
    if (b && SITUACOES_BOLETO_VALIDO.includes(b.situacao) && (b.linha_digitavel || b.pix_copia_e_cola)) mapa.set(id, { linhaDigitavel: b.linha_digitavel, pixCopiaECola: b.pix_copia_e_cola });
    else if (aEmitir.includes(id)) mapa.set(id, "previa");
  }
  return mapa;
}

export async function previaDoEnvio(supabase: Supa, envioId: string) {
  const [envio, config] = await Promise.all([carregarEnvio(supabase, envioId), carregarConfiguracaoCobranca(supabase)]);
  const { assunto, html } = await montarEmailDoEnvio(supabase, envio, config);
  // Na tela o logo não vem como anexo: troca o cid: pela imagem pública.
  return { assunto, destinatarios: envio.destinatarios, html: html.replace(/src="cid:logo-footlink"/, 'src="/email/footlink-logo.png"').replace(/src="cid:logo-footure"/, 'src="/email/footure-logo.png"') };
}

/** Parcelas do envio ainda devidas: confere no Bling ao vivo (ou, sem token, no cache). */
async function parcelasAindaDevidas(supabase: Supa, itens: { parcela_id: number }[]): Promise<Set<number>> {
  // Paga pelo boleto do Inter (F2): fora, mesmo antes da baixa no Bling.
  const boletos = await boletosDasParcelas(supabase, [...new Set(itens.map((i) => i.parcela_id))]);
  const ids = [...new Set(itens.map((i) => i.parcela_id))].filter((id) => !SITUACOES_BOLETO_PAGO.includes(boletos.get(id)?.situacao ?? ""));
  const token = await tokenBlingSeguro(supabase);
  if (token) {
    const devidas = new Set<number>();
    for (const id of ids) {
      try {
        const { data } = await consultarBling<{ data: { situacao: number } }>(token, `/contas/receber/${id}`);
        if (!SITUACOES_ENCERRADAS.has(data.situacao)) devidas.add(id);
      } catch (e) {
        // Conta apagada no Bling: não cobra. Outra falha: segue pelo cache.
        const msg = e instanceof Error ? e.message : String(e);
        if (/retornou 404/.test(msg)) continue;
        const { data } = await supabase.from("bling_parcelas").select("situacao").eq("id", id).maybeSingle();
        if (data && !SITUACOES_ENCERRADAS.has(data.situacao)) devidas.add(id);
      }
    }
    return devidas;
  }
  const { data } = await supabase.from("bling_parcelas").select("id, situacao").in("id", ids);
  return new Set((data ?? []).filter((p) => !SITUACOES_ENCERRADAS.has(p.situacao)).map((p) => p.id));
}

/** Envia um envio pendente (ou com erro, para tentar de novo). Devolve o status final. */
export async function enviarEnvio(supabase: Supa, envioId: string, decididoPor?: string): Promise<CobrancaEnvioRow["status"]> {
  const [envio, config] = await Promise.all([carregarEnvio(supabase, envioId), carregarConfiguracaoCobranca(supabase)]);
  if (envio.status !== "pendente" && envio.status !== "erro") throw new Error("Este envio já foi decidido.");
  // Envio gerado em teste nunca vai ao cliente real, mesmo que o modo de teste tenha sido desligado por fora da tela.
  if (envio.teste && !config.email_teste) throw new Error("Envio gerado em modo de teste: só pode sair com o modo de teste ligado.");
  const decisao = decididoPor ? { decidido_por: decididoPor, decidido_em: new Date().toISOString() } : {};

  // As parcelas da etapa e as demais vencidas do cliente (listadas juntas no e-mail), conferidas no Bling.
  const vencidasCache = await parcelasVencidasDoCliente(supabase, envio.contato_id, config, new Set(envio.itens.map((i) => i.parcela_id)), hojeBrt(), temParcelaAVencer(envio));
  const devidas = await parcelasAindaDevidas(supabase, [...envio.itens, ...vencidasCache]);
  const itens = envio.itens.filter((i) => devidas.has(i.parcela_id));
  const vencidas = vencidasCache.filter((p) => devidas.has(p.parcela_id));
  if (itens.length === 0) {
    await supabase.from("cobranca_envios").update({ status: "cancelado", erro: "As parcelas foram pagas antes do envio.", ...decisao }).eq("id", envioId);
    return "cancelado";
  }

  try {
    const interno = envio.tipo === "escalonamento";
    const destinatarios = interno
      ? normalizarEmails(config.emails_escalonamento)
      : (await destinatariosDaCobranca(supabase, envio.contato_id, pedidosDe(itens), await tokenBlingSeguro(supabase))).emails;
    if (!destinatarios.length) throw new Error(interno ? "Lista de escalonamento vazia." : "Cliente sem e-mail válido no Bling e sem destinatários extras na régua.");
    // Cobrança (F2): emite (ou reaproveita) o boleto de cada parcela no Inter e anexa os PDFs. Em teste, nada é emitido.
    let pagamentos: Map<number, ItemEmailCobranca["pagamento"]> | undefined;
    const anexosBoleto: { nome: string; base64: string }[] = [];
    if (envio.tipo === "cobranca" && !config.email_teste) {
      const boletos = [];
      for (const i of itens) boletos.push(await garantirBoleto(supabase, config, { ...i, contato_id: envio.contato_id, valor: Number(i.valor) }, decididoPor));
      pagamentos = await pagamentosDosBoletos(supabase, [...itens, ...vencidas].map((i) => i.parcela_id), []);
      anexosBoleto.push(...(await pdfsDosBoletos(boletos)));
    }
    const email = await montarEmailDoEnvio(supabase, { ...envio, itens }, config, hojeBrt(), vencidas, pagamentos);
    // Homologação: o e-mail ao cliente vai só para o endereço de teste. A marca vai no FIM do
    // assunto, com o nome do cliente: o Gmail ignora prefixos entre colchetes ao agrupar
    // conversas, e cobranças de clientes diferentes com o mesmo assunto viravam uma só.
    const teste = !interno && config.email_teste ? config.email_teste : null;
    const assunto = teste ? `${email.assunto} · TESTE ${await nomeDoCliente(supabase, envio.contato_id)} → ${destinatarios.join(", ")}` : email.assunto;
    const resendId = await enviarEmailResend({
      de: interno ? `Footure OS <${enderecoRemetentePadrao()}>` : `${config.remetente_nome} <${config.remetente_email || enderecoRemetentePadrao()}>`,
      para: teste ? [teste] : destinatarios,
      responderPara: interno ? undefined : config.responder_para,
      assunto,
      html: email.html,
      texto: email.texto,
      anexos: [...email.anexos, ...anexosBoleto],
    });
    await supabase
      .from("cobranca_envios")
      .update({ status: "enviado", resend_id: resendId, assunto, destinatarios, erro: null, enviado_em: new Date().toISOString(), ...decisao })
      .eq("id", envioId);
    return "enviado";
  } catch (e) {
    await supabase.from("cobranca_envios").update({ status: "erro", erro: e instanceof Error ? e.message : String(e), ...decisao }).eq("id", envioId);
    return "erro";
  }
}

/**
 * "Gerar boleto" da tela: emite no Inter os boletos da cobrança SEM enviar o
 * e-mail — a prévia passa a mostrar a linha digitável e o Pix reais e o PDF
 * pode ser baixado para conferência. Parcela já paga fica de fora.
 */
export async function gerarBoletosDoEnvio(supabase: Supa, envioId: string, emitidoPor?: string): Promise<number> {
  const [envio, config] = await Promise.all([carregarEnvio(supabase, envioId), carregarConfiguracaoCobranca(supabase)]);
  if (envio.tipo !== "cobranca") throw new Error("Só a cobrança (boleto) gera boleto.");
  if (envio.status !== "pendente" && envio.status !== "erro") throw new Error("Este envio já foi decidido.");
  if (config.email_teste || envio.teste) throw new Error("Em modo de teste nenhum boleto é emitido.");
  const devidas = await parcelasAindaDevidas(supabase, envio.itens);
  let gerados = 0;
  for (const i of envio.itens.filter((x) => devidas.has(x.parcela_id))) {
    await garantirBoleto(supabase, config, { ...i, contato_id: envio.contato_id, valor: Number(i.valor) }, emitidoPor);
    gerados++;
  }
  return gerados;
}

/** Descarte de uma cobrança: cancela no Inter os boletos que o sistema já tinha gerado para ela. */
export async function cancelarBoletosDoEnvio(supabase: Supa, envioId: string): Promise<number> {
  const envio = await carregarEnvio(supabase, envioId);
  // Só cobrança ainda não enviada: o boleto de um e-mail que já saiu nunca é cancelado por aqui.
  if (envio.tipo !== "cobranca" || (envio.status !== "pendente" && envio.status !== "erro")) return 0;
  return cancelarBoletosDasParcelas(supabase, envio.itens.map((i) => i.parcela_id), "Cobranca descartada no Footure OS");
}

const ENTREGA_POR_EVENTO: Record<string, EntregaEnvioCobranca> = {
  "email.delivered": "entregue",
  "email.delivery_delayed": "atrasada",
  "email.bounced": "devolvido",
  "email.complained": "spam",
};

/** Evento do webhook do Resend → situação de entrega do envio. Devolvido/spam não são sobrescritos por eventos posteriores. */
export async function registrarEventoEntrega(supabase: Supa, evento: { type: string; created_at?: string; data?: { email_id?: string; bounce?: { message?: string } } }) {
  const entrega = ENTREGA_POR_EVENTO[evento.type];
  const resendId = evento.data?.email_id;
  if (!entrega || !resendId) return false;
  const { data: envio } = await supabase.from("cobranca_envios").select("id, entrega").eq("resend_id", resendId).maybeSingle();
  if (!envio) return false;
  if ((envio.entrega === "devolvido" || envio.entrega === "spam") && entrega !== "devolvido" && entrega !== "spam") return true;
  await supabase
    .from("cobranca_envios")
    .update({ entrega, entrega_detalhe: evento.data?.bounce?.message ?? null, entrega_em: evento.created_at ?? new Date().toISOString() })
    .eq("id", envio.id);
  return true;
}

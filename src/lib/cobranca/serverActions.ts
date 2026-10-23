"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import { exigirPapel } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PAPEIS_COBRANCA } from "./permissoes";
import { cobrarAtrasadosForaDaRegua, destinatariosDaCobranca, enviarEnvio, gerarEnviosDoDia, previaDoEnvio, type ResumoGeracao } from "./regua";
import { lerRegua, normalizarEmails } from "./regras";
import { pendenciasEmissaoInter } from "./boletos";
import { registrarWebhookInter } from "@/lib/integracoes/inter";
import { urlDoSistema } from "@/lib/email/layout";

// Gerar, enviar, pré-visualizar e reler e-mails usam o client de serviço depois
// de exigirPapel: leem os pedidos (e-mails do financeiro, que a RLS só mostra ao
// dono e à Diretoria) e as credenciais do Bling (só Diretoria).
const TELA = "/financeiro/cobranca";

const ConfiguracaoSchema = z.object({
  modo: z.enum(["desligado", "aprovacao", "automatico"]),
  regua: z.string(),
  escalonamentoDias: z.number().int().min(1).max(90),
  dataCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  remetenteNome: z.string().trim().min(1).max(80),
  remetenteEmail: z.string().trim(),
  responderPara: z.string(),
  emailsEscalonamento: z.string(),
  chavePix: z.string().trim(),
  emailTeste: z.string().trim(),
});

export async function salvarConfiguracaoCobranca(dados: z.input<typeof ConfiguracaoSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel(...PAPEIS_COBRANCA);
    const d = ConfiguracaoSchema.parse(dados);
    const regua = lerRegua(d.regua);
    if (!regua) throw new Error("Régua inválida: informe os dias separados por vírgula (ex.: -3, 0, 3, 7, 12).");
    if (d.modo !== "desligado" && !d.dataCorte) throw new Error("Defina a data de corte antes de ligar a régua.");
    const remetenteEmail = d.remetenteEmail ? normalizarEmails(d.remetenteEmail)[0] : null;
    if (d.remetenteEmail && !remetenteEmail) throw new Error("E-mail do remetente inválido.");
    const emailTeste = d.emailTeste ? normalizarEmails(d.emailTeste)[0] : null;
    if (d.emailTeste && !emailTeste) throw new Error("E-mail de teste inválido.");
    const supabase = await createClient();
    // Saindo do modo de teste: os envios de teste somem, para as etapas deles voltarem a valer nos envios reais.
    if (!emailTeste) {
      const { error: erroLimpeza } = await supabase.from("cobranca_envios").delete().eq("teste", true);
      if (erroLimpeza) throw new Error(`Falha ao apagar os envios de teste: ${erroLimpeza.message}`);
    }
    const { error } = await supabase
      .from("cobranca_configuracao")
      .update({
        modo: d.modo,
        regua_dias: regua,
        escalonamento_dias: d.escalonamentoDias,
        data_corte: d.dataCorte,
        remetente_nome: d.remetenteNome,
        remetente_email: remetenteEmail,
        responder_para: normalizarEmails(d.responderPara),
        emails_escalonamento: normalizarEmails(d.emailsEscalonamento),
        chave_pix: d.chavePix || null,
        email_teste: emailTeste,
        atualizado_em: new Date().toISOString(),
        atualizado_por: sessao.id,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath(TELA);
  });
}

const ConfiguracaoInterSchema = z.object({
  emissaoAtiva: z.boolean(),
  antecedenciaDias: z.number().int().min(1).max(30),
  multaPercentual: z.number().min(0).max(10).nullable(),
  jurosMensalPercentual: z.number().min(0).max(10).nullable(),
  diasValidade: z.number().int().min(0).max(60),
  dataCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/** Parâmetros da F2 (boleto + Pix do Inter). Só liga a emissão com tudo definido. */
export async function salvarConfiguracaoInter(dados: z.input<typeof ConfiguracaoInterSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel(...PAPEIS_COBRANCA);
    const d = ConfiguracaoInterSchema.parse(dados);
    const supabase = await createClient();
    const { data: atual, error: erroLeitura } = await supabase.from("cobranca_configuracao").select("*").eq("id", true).single();
    if (erroLeitura || !atual) throw new Error("Configuração da régua não encontrada.");
    const nova = {
      inter_emissao_ativa: d.emissaoAtiva,
      inter_antecedencia_dias: d.antecedenciaDias,
      inter_multa_percentual: d.multaPercentual,
      inter_juros_mensal_percentual: d.jurosMensalPercentual,
      inter_dias_validade: d.diasValidade,
      inter_data_corte: d.dataCorte,
    };
    if (d.emissaoAtiva) {
      const faltam = pendenciasEmissaoInter({ ...atual, ...nova });
      if (faltam.length) throw new Error(`Para ligar a emissão, falta: ${faltam.join("; ")}.`);
    }
    const { error } = await supabase.from("cobranca_configuracao").update({ ...nova, atualizado_em: new Date().toISOString(), atualizado_por: sessao.id }).eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath(TELA);
  });
}

/** Registra no Inter o endereço que recebe os avisos de pagamento (com a chave secreta). */
export async function registrarWebhookInterAction(): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel(...PAPEIS_COBRANCA);
    const segredo = process.env.INTER_WEBHOOK_SEGREDO;
    if (!segredo) throw new Error("Cadastre INTER_WEBHOOK_SEGREDO nas variáveis de ambiente antes de registrar o webhook.");
    const url = urlDoSistema();
    if (!url.startsWith("https://")) throw new Error(`O Inter só aceita endereço https — o sistema está em ${url}. Registre a partir da produção.`);
    await registrarWebhookInter(`${url}/api/webhooks/inter?chave=${encodeURIComponent(segredo)}`);
    revalidatePath(TELA);
  });
}

const RegraSchema = z.object({
  contatoId: z.number().int(),
  pausada: z.boolean(),
  motivoPausa: z.string().trim(),
  regua: z.string().trim(),
  destinatariosExtra: z.string(),
  /** Janela própria do envio da cobrança (boleto): antecedência em dias ou "até o dia X do mês" (0064). */
  cobrancaAntecedenciaDias: z.number().int().min(1).max(45).nullable(),
  cobrancaDiaMes: z.number().int().min(1).max(28).nullable(),
});

export async function salvarRegraCliente(dados: z.input<typeof RegraSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel(...PAPEIS_COBRANCA);
    const d = RegraSchema.parse(dados);
    const regua = d.regua ? lerRegua(d.regua) : null;
    if (d.regua && !regua) throw new Error("Régua inválida: informe os dias separados por vírgula (ex.: -5, 0, 3) ou deixe em branco para usar a padrão.");
    if (d.pausada && !d.motivoPausa) throw new Error("Informe o motivo da pausa.");
    const supabase = await createClient();
    const { error } = await supabase.from("cobranca_clientes").upsert({
      contato_id: d.contatoId,
      pausada: d.pausada,
      motivo_pausa: d.pausada ? d.motivoPausa : null,
      regua_dias: regua,
      destinatarios_extra: normalizarEmails(d.destinatariosExtra),
      cobranca_antecedencia_dias: d.cobrancaAntecedenciaDias,
      cobranca_dia_mes: d.cobrancaDiaMes,
      atualizado_em: new Date().toISOString(),
      atualizado_por: sessao.id,
    });
    if (error) throw new Error(error.message);
    revalidatePath(TELA);
  });
}

/** Relê agora os e-mails no Bling — observações dos pedidos em aberto e cadastro do contato — sem esperar os 7 dias do cache. */
export async function atualizarEmailsDoCliente(contatoId: number): Promise<ResultadoAcao & { emails?: string[]; origem?: string }> {
  let resultado: Awaited<ReturnType<typeof destinatariosDaCobranca>> | null = null;
  const r = await executar(async () => {
    await exigirPapel(...PAPEIS_COBRANCA);
    const supabase = createServiceClient();
    const { obterAccessTokenValido } = await import("@/lib/integracoes/bling");
    const { carregarBaseParcelas } = await import("@/lib/financeiro/carteira");
    const base = await carregarBaseParcelas(supabase);
    const pedidos = base.parcelas
      .filter((p) => p.contatoId === contatoId && (p.situacao === "em_aberto" || p.situacao === "atrasada") && p.numeroPedidoOrigem)
      .map((p) => base.pedidoPorChave.get(`${contatoId}:${p.numeroPedidoOrigem}`)?.id)
      .filter((id): id is number => !!id);
    resultado = await destinatariosDaCobranca(supabase, contatoId, pedidos, await obterAccessTokenValido(supabase), true);
    revalidatePath(TELA);
  });
  return r.erro || !resultado ? r : resultado;
}

export async function enviarEnviosAprovados(ids: string[]): Promise<ResultadoAcao & { enviados?: number; cancelados?: number; falhas?: number }> {
  const contagem = { enviados: 0, cancelados: 0, falhas: 0 };
  const r = await executar(async () => {
    const sessao = await exigirPapel(...PAPEIS_COBRANCA);
    const supabase = createServiceClient();
    for (const id of z.array(z.string().uuid()).parse(ids)) {
      const status = await enviarEnvio(supabase, id, sessao.id);
      if (status === "enviado") contagem.enviados++;
      else if (status === "cancelado") contagem.cancelados++;
      else contagem.falhas++;
    }
    revalidatePath(TELA);
  });
  return r.erro ? r : contagem;
}

export async function descartarEnvio(id: string): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel(...PAPEIS_COBRANCA);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cobranca_envios")
      .update({ status: "descartado", decidido_por: sessao.id, decidido_em: new Date().toISOString() })
      .eq("id", z.string().uuid().parse(id))
      .in("status", ["pendente", "erro"]);
    if (error) throw new Error(error.message);
    revalidatePath(TELA);
  });
}

export async function previaEnvioCobranca(id: string): Promise<ResultadoAcao & { assunto?: string; html?: string; destinatarios?: string[] }> {
  let previa: Awaited<ReturnType<typeof previaDoEnvio>> | null = null;
  const r = await executar(async () => {
    await exigirPapel(...PAPEIS_COBRANCA);
    previa = await previaDoEnvio(createServiceClient(), z.string().uuid().parse(id));
  });
  return r.erro || !previa ? r : previa;
}

/** "Cobrar atrasados": lista os clientes fora da régua (simular) ou gera os envios, pendentes de aprovação. */
export async function cobrarAtrasadosAction(simular: boolean): Promise<ResultadoAcao & { clientes?: Awaited<ReturnType<typeof cobrarAtrasadosForaDaRegua>> }> {
  let clientes: Awaited<ReturnType<typeof cobrarAtrasadosForaDaRegua>> = [];
  const r = await executar(async () => {
    await exigirPapel(...PAPEIS_COBRANCA);
    clientes = await cobrarAtrasadosForaDaRegua(createServiceClient(), { simular });
    if (!simular) revalidatePath(TELA);
  });
  return r.erro ? r : { clientes };
}

/** Roda a geração do dia agora (a mesma do cron das 9h). */
export async function gerarEnviosAgora(): Promise<ResultadoAcao & { resumo?: ResumoGeracao }> {
  let resumo: ResumoGeracao | undefined;
  const r = await executar(async () => {
    await exigirPapel(...PAPEIS_COBRANCA);
    resumo = await gerarEnviosDoDia(createServiceClient());
    revalidatePath(TELA);
  });
  return r.erro ? r : { resumo };
}

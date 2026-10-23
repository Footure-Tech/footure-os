"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import { exigirPapel } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { FinAlertaRow } from "@/lib/supabase/database.types";
import { avaliarAlertas } from "./alertas";
import { enviarResumoDiario } from "./resumoDiario";
import { executarRotinaControladoria } from "./rotina";

// Controladoria: só Diretoria (decisão de 22/10). A sincronização e o resumo
// usam o client de serviço depois de exigirPapel (e-mails em auth.users).
const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function revalidarTelas() {
  revalidatePath("/controladoria", "layout");
}

export async function atualizarDadosControladoria(): Promise<ResultadoAcao & { resumo?: { detalhados: number; pendentes: number; alertasNovos: number; erro: string | null } }> {
  let resumo: { detalhados: number; pendentes: number; alertasNovos: number; erro: string | null } | undefined;
  const r = await executar(async () => {
    const sessao = await exigirPapel("admin");
    const resultado = await executarRotinaControladoria(createServiceClient(), { origem: "manual", disparadoPor: sessao.id });
    resumo = {
      detalhados: resultado.sincronizacao?.detalhados ?? 0,
      pendentes: resultado.sincronizacao?.detalhesPendentes ?? 0,
      alertasNovos: resultado.alertas.novos,
      erro: resultado.erroSincronizacao,
    };
    revalidarTelas();
  });
  return { ...r, resumo };
}

const SaldosSchema = z.object({
  data: DATA,
  saldos: z.array(z.object({ id: z.number().int(), saldo: z.number().finite().nullable() })),
});

/** Saldos do dia (as contas do Bling são manuais): todos com a mesma data, base da projeção de caixa. */
export async function salvarSaldosControladoria(dados: z.input<typeof SaldosSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel("admin");
    const d = SaldosSchema.parse(dados);
    if (d.data > hojeLocal()) throw new Error("A data dos saldos não pode ser futura.");
    const supabase = await createClient();
    const agora = new Date().toISOString();
    for (const s of d.saldos) {
      const { error } = await supabase
        .from("fin_contas_financeiras")
        .update(
          s.saldo === null
            ? { saldo_informado: null, saldo_informado_em: null, atualizado_por: sessao.id, atualizado_em: agora }
            : { saldo_informado: s.saldo, saldo_informado_em: d.data, atualizado_por: sessao.id, atualizado_em: agora },
        )
        .eq("id", s.id);
      if (error) throw new Error(error.message);
    }
    await avaliarAlertas(supabase);
    revalidarTelas();
  });
}

const CamadaSchema = z.object({ id: z.number().int(), camada: z.enum(["disponivel", "liquidez", "aplicacao", "gateway", "cartao", "ignorar"]) });

export async function salvarCamadaConta(dados: z.input<typeof CamadaSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel("admin");
    const d = CamadaSchema.parse(dados);
    const supabase = await createClient();
    const { error } = await supabase
      .from("fin_contas_financeiras")
      .update({ camada: d.camada, atualizado_por: sessao.id, atualizado_em: new Date().toISOString() })
      .eq("id", d.id);
    if (error) throw new Error(error.message);
    revalidarTelas();
  });
}

const PremissasSchema = z.object({
  colchaoMeses: z.number().min(0).max(24),
  runwayAlertaMeses: z.number().min(0).max(36),
  diasConciliacao: z.number().int().min(1).max(60),
  excedenteMeses: z.number().min(0).max(24),
  despesaSubiuPct: z.number().int().min(1).max(500),
  fornecedorNovoValor: z.number().min(0),
  duplicidadeDias: z.number().int().min(0).max(30),
  receberAntigoDias: z.number().int().min(30).max(1000),
  cobrancaAntecedenciaDias: z.number().int().min(0).max(30),
  resumoDiarioAtivo: z.boolean(),
});

export async function salvarPremissasControladoria(dados: z.input<typeof PremissasSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel("admin");
    const d = PremissasSchema.parse(dados);
    const supabase = await createClient();
    const { error } = await supabase
      .from("fin_premissas")
      .update({
        colchao_meses: d.colchaoMeses,
        runway_alerta_meses: d.runwayAlertaMeses,
        dias_conciliacao: d.diasConciliacao,
        excedente_meses: d.excedenteMeses,
        despesa_subiu_pct: d.despesaSubiuPct,
        fornecedor_novo_valor: d.fornecedorNovoValor,
        duplicidade_dias: d.duplicidadeDias,
        receber_antigo_dias: d.receberAntigoDias,
        cobranca_antecedencia_dias: d.cobrancaAntecedenciaDias,
        resumo_diario_ativo: d.resumoDiarioAtivo,
        atualizado_em: new Date().toISOString(),
        atualizado_por: sessao.id,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await avaliarAlertas(supabase);
    revalidarTelas();
  });
}

const AcaoAlertaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("atribuir"), alertaId: z.string().uuid(), responsavelId: z.string().uuid().nullable() }),
  z.object({ acao: z.literal("adiar"), alertaId: z.string().uuid(), ate: DATA, motivo: z.string().trim().min(3).max(500) }),
  z.object({ acao: z.literal("encerrar"), alertaId: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }),
  z.object({ acao: z.literal("reabrir"), alertaId: z.string().uuid() }),
]);

export async function agirSobreAlerta(dados: z.input<typeof AcaoAlertaSchema>): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel("admin");
    const d = AcaoAlertaSchema.parse(dados);
    const supabase = await createClient();
    const { data: alerta, error: erroBusca } = await supabase.from("fin_alertas").select("id, status, responsavel_id").eq("id", d.alertaId).single();
    if (erroBusca || !alerta) throw new Error("Alerta não encontrado.");
    if (alerta.status === "resolvido") throw new Error("Este alerta já foi resolvido: a condição deixou de existir.");
    const agora = new Date().toISOString();

    let mudanca: Partial<FinAlertaRow>;
    let evento: { tipo: "atribuido" | "adiado" | "encerrado" | "reaberto"; detalhe: string | null };
    if (d.acao === "atribuir") {
      let nome = "ninguém";
      if (d.responsavelId) {
        const { data: pessoa } = await supabase.from("profiles").select("nome").eq("user_id", d.responsavelId).single();
        nome = pessoa?.nome ?? "—";
      }
      mudanca = { responsavel_id: d.responsavelId, status: alerta.status === "novo" && d.responsavelId ? "em_tratamento" : alerta.status };
      evento = { tipo: "atribuido", detalhe: `Responsável: ${nome}` };
    } else if (d.acao === "adiar") {
      if (d.ate <= hojeLocal()) throw new Error("Escolha uma data futura para adiar.");
      mudanca = { status: "adiado", adiado_ate: d.ate, motivo: d.motivo };
      evento = { tipo: "adiado", detalhe: `Até ${d.ate.split("-").reverse().join("/")}: ${d.motivo}` };
    } else if (d.acao === "encerrar") {
      mudanca = { status: "encerrado", motivo: d.motivo };
      evento = { tipo: "encerrado", detalhe: d.motivo };
    } else {
      mudanca = { status: alerta.responsavel_id ? "em_tratamento" : "novo", adiado_ate: null, motivo: null };
      evento = { tipo: "reaberto", detalhe: null };
    }
    const { error } = await supabase.from("fin_alertas").update({ ...mudanca, atualizado_em: agora }).eq("id", d.alertaId);
    if (error) throw new Error(error.message);
    const { error: erroEvento } = await supabase.from("fin_alerta_eventos").insert({ alerta_id: d.alertaId, tipo: evento.tipo, detalhe: evento.detalhe, autor_id: sessao.id });
    if (erroEvento) throw new Error(erroEvento.message);
    revalidarTelas();
  });
}

/** Envia o resumo de hoje agora (teste ou reenvio), mesmo que já tenha saído ou não haja alertas. */
export async function enviarResumoAgora(): Promise<ResultadoAcao & { destinatarios?: number; motivo?: string }> {
  let saida: { destinatarios?: number; motivo?: string } = {};
  const r = await executar(async () => {
    await exigirPapel("admin");
    const resultado = await enviarResumoDiario(createServiceClient(), { forcar: true });
    saida = resultado.enviado ? { destinatarios: resultado.destinatarios } : { motivo: resultado.motivo };
  });
  return { ...r, ...saida };
}

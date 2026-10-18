"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import type { BuFunil } from "@/lib/supabase/database.types";
import { sincronizarMarketing, type ResultadoSincronizacao } from "./sincronizacao";
import { gerarSugestoesIa } from "./sugestoesIa";
import { iniciarVerificacao, relerParametrosCampanha, verificarAgora } from "./verificacaoRastreio";

/** Prazo da sincronização manual: a página de Configurações tem maxDuration de 300 s. */
const PRAZO_MANUAL_MS = 240_000;

/** "Sincronizar agora" (Diretoria): continua a carga do histórico ou faz o incremental. */
export async function sincronizarMarketingAction(): Promise<ResultadoAcao & { resultados?: ResultadoSincronizacao[] }> {
  let resultados: ResultadoSincronizacao[] = [];
  const r = await executar(async () => {
    const sessao = await exigirPapel("admin");
    resultados = await sincronizarMarketing(await createClient(), { origem: "manual", disparadoPor: sessao.id, prazoMs: PRAZO_MANUAL_MS });
    revalidatePath("/admin/configuracoes");
  });
  return r.erro ? r : { resultados };
}

/** BU de um funil do Kommo, definida à mão (a sincronização não sobrescreve mais). */
export async function definirBuFunilAction(pipelineId: number, bu: BuFunil): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel("admin");
    if (!["academy", "footlink", "fora"].includes(bu)) throw new Error("BU inválida.");
    const supabase = await createClient();
    const { error } = await supabase.from("mkt_kommo_funis").update({ bu, bu_manual: true }).eq("pipeline_id", pipelineId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/configuracoes");
  });
}

/** "Gerar novas sugestões" (Sugestões por IA da campanha): uma chamada ao Claude, gravada com tokens e custo. */
export async function gerarSugestoesIaAction(chaveCampanha: string, periodo: "30d" | "90d"): Promise<ResultadoAcao & { id?: string }> {
  let id: string | undefined;
  const r = await executar(async () => {
    const sessao = await exigirPapel("admin");
    id = await gerarSugestoesIa(await createClient(), chaveCampanha, periodo === "30d" ? "30d" : "90d", sessao.id);
    revalidatePath(`/marketing/campanhas/${encodeURIComponent(chaveCampanha)}`);
  });
  return r.erro ? r : { id };
}

/** Inicia uma verificação de ponta a ponta do rastreio da campanha (link de teste + código). */
export async function iniciarVerificacaoRastreioAction(chaveCampanha: string): Promise<ResultadoAcao & { id?: string }> {
  let id: string | undefined;
  const r = await executar(async () => {
    const sessao = await exigirPapel("admin");
    id = await iniciarVerificacao(await createClient(), chaveCampanha, sessao.id);
    revalidatePath(`/marketing/campanhas/${encodeURIComponent(chaveCampanha)}`);
  });
  return r.erro ? r : { id };
}

/** Procura o lead de teste no Kommo e grava o resultado da verificação. */
export async function verificarRastreioAction(verificacaoId: string, chaveCampanha: string): Promise<ResultadoAcao & { encontrado?: boolean; status?: string }> {
  let saida: { encontrado: boolean; status: string } | undefined;
  const r = await executar(async () => {
    await exigirPapel("admin");
    saida = await verificarAgora(await createClient(), verificacaoId);
    revalidatePath(`/marketing/campanhas/${encodeURIComponent(chaveCampanha)}`);
  });
  return r.erro ? r : { ...saida };
}

/** Relê na Meta os parâmetros de URL dos anúncios da campanha (depois de corrigir um anúncio). */
export async function relerParametrosRastreioAction(chaveCampanha: string): Promise<ResultadoAcao & { anuncios?: number; comErro?: number }> {
  let saida: { anuncios: number; comErro: number } | undefined;
  const r = await executar(async () => {
    await exigirPapel("admin");
    saida = await relerParametrosCampanha(await createClient(), chaveCampanha);
    revalidatePath(`/marketing/campanhas/${encodeURIComponent(chaveCampanha)}`);
  });
  return r.erro ? r : { ...saida };
}

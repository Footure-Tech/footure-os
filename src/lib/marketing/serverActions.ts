"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import type { BuFunil } from "@/lib/supabase/database.types";
import { sincronizarMarketing, type ResultadoSincronizacao } from "./sincronizacao";

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

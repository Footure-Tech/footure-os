// Rotina da Controladoria: sincroniza o financeiro do Bling (dentro da trava
// de 0053), avalia os alertas e, no cron da manhã, envia o resumo diário.
// Alertas e resumo rodam mesmo se a sincronização falhar — a falha vira o
// alerta "sync_erro" e os demais seguem sobre o último cache bom.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sincronizarControladoriaBling } from "@/lib/integracoes/blingSincronizacao";
import { avaliarAlertas } from "./alertas";
import { enviarResumoDiario } from "./resumoDiario";

type Supa = SupabaseClient<Database>;

export async function executarRotinaControladoria(
  supabase: Supa,
  opcoes: { origem: "cron" | "manual"; disparadoPor?: string | null; enviarResumo?: boolean },
) {
  let sincronizacao: Awaited<ReturnType<typeof sincronizarControladoriaBling>> | null = null;
  let erroSincronizacao: string | null = null;
  try {
    sincronizacao = await sincronizarControladoriaBling(supabase, { origem: opcoes.origem, disparadoPor: opcoes.disparadoPor });
  } catch (erro) {
    erroSincronizacao = erro instanceof Error ? erro.message : String(erro);
    console.error("[controladoria] sincronização:", erroSincronizacao);
  }
  const alertas = await avaliarAlertas(supabase);
  let resumo: Awaited<ReturnType<typeof enviarResumoDiario>> | null = null;
  if (opcoes.enviarResumo) {
    try {
      resumo = await enviarResumoDiario(supabase);
    } catch (erro) {
      console.error("[controladoria] resumo diário:", erro instanceof Error ? erro.message : erro);
      resumo = { enviado: false, motivo: erro instanceof Error ? erro.message : String(erro) };
    }
  }
  return { sincronizacao, erroSincronizacao, alertas, resumo };
}

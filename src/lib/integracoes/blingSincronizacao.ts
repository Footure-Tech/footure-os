import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { obterAccessTokenValido, sincronizarContatosBling } from "@/lib/integracoes/bling";
import { sincronizarVendasAcademy } from "@/lib/academy/vendas";

type Supa = SupabaseClient<Database>;

export type ResultadoSincronizacaoBling = Awaited<ReturnType<typeof sincronizarContatosBling>>;

// Acima disso uma execução 'rodando' é de uma função já morta: o limite das
// funções da Vercel é 300 s (maxDuration da rota do cron e das páginas).
const EXECUCAO_ABANDONADA_MS = 10 * 60_000;

/** Encerra execução abandonada e registra a nova; null = já há uma rodando (índice único de 0053). */
async function iniciarExecucao(supabase: Supa, origem: "cron" | "manual", disparadoPor: string | null): Promise<string | null> {
  await supabase
    .from("bling_sync_execucoes")
    .update({ status: "erro", erro: "Interrompida (excedeu o tempo da função).", terminado_em: new Date().toISOString() })
    .eq("status", "rodando")
    .lt("iniciado_em", new Date(Date.now() - EXECUCAO_ABANDONADA_MS).toISOString());

  const { data, error } = await supabase
    .from("bling_sync_execucoes")
    .insert({ origem, disparado_por: disparadoPor })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(`Falha ao registrar a sincronização do Bling: ${error.message}`);
  return data.id;
}

export type EtapaSincronizacaoBling = "footlink" | "academy";
type OpcoesSincronizacao = { origem: "cron" | "manual"; disparadoPor?: string | null };

/**
 * Roda uma etapa registrando a execução em bling_sync_execucoes (resumo.etapa)
 * e recusando se outra estiver em andamento (trava de 0053). As etapas são
 * execuções separadas porque juntas passavam do limite de 5 min da função na
 * Vercel (Footlink ~2 min com contatos em paralelo; Academy ~1 min).
 */
async function comExecucao<T extends object>(supabase: Supa, opcoes: OpcoesSincronizacao, etapa: EtapaSincronizacaoBling, executar: () => Promise<T>): Promise<T> {
  const id = await iniciarExecucao(supabase, opcoes.origem, opcoes.disparadoPor ?? null);
  if (!id) throw new Error("Já há uma sincronização com o Bling em andamento — aguarde alguns minutos.");
  try {
    const resultado = await executar();
    await supabase
      .from("bling_sync_execucoes")
      .update({ status: "ok", erro: null, resumo: { etapa, ...resultado }, terminado_em: new Date().toISOString() })
      .eq("id", id);
    return resultado;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await supabase
      .from("bling_sync_execucoes")
      .update({ status: "erro", erro: etapa === "academy" ? `Vendas do Academy: ${mensagem}` : mensagem, resumo: { etapa }, terminado_em: new Date().toISOString() })
      .eq("id", id);
    throw erro;
  } finally {
    revalidatePath("/", "layout"); // card de Integrações da sidebar
    revalidatePath("/clientes");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/inadimplencia");
    revalidatePath("/vendas");
  }
}

/** Footlink: contatos, pedidos, parcelas e baixas (o que a régua de cobrança e a inadimplência usam). */
export function sincronizarFootlinkBling(supabase: Supa, opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacaoBling> {
  return comExecucao(supabase, opcoes, "footlink", () => sincronizarContatosBling(supabase));
}

/** Footure Academy: vendas, parcelas e baixas (0042). */
export function sincronizarAcademyBling(supabase: Supa, opcoes: OpcoesSincronizacao) {
  return comExecucao(supabase, opcoes, "academy", async () => sincronizarVendasAcademy(supabase, await obterAccessTokenValido(supabase)));
}

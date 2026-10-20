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

/**
 * Sincronização completa com o Bling — contatos/pedidos/parcelas/baixas do
 * Footlink e vendas do Footure Academy. Ponto único para o botão da sidebar e
 * o cron (/api/cron/bling): registra a execução em bling_sync_execucoes e
 * recusa se outra estiver em andamento (ver 0053).
 */
export async function executarSincronizacaoBling(
  supabase: Supa,
  opcoes: { origem: "cron" | "manual"; disparadoPor?: string | null },
): Promise<ResultadoSincronizacaoBling> {
  const id = await iniciarExecucao(supabase, opcoes.origem, opcoes.disparadoPor ?? null);
  if (!id) throw new Error("Já há uma sincronização com o Bling em andamento — aguarde alguns minutos.");

  try {
    const resultado = await sincronizarContatosBling(supabase);
    // Vendas do Footure Academy (0042) — falha aqui não derruba a sincronização do Footlink.
    let erroAcademy: string | null = null;
    try {
      await sincronizarVendasAcademy(supabase, await obterAccessTokenValido(supabase));
    } catch (erro) {
      erroAcademy = erro instanceof Error ? erro.message : String(erro);
      console.error("[academy] sincronização das vendas:", erroAcademy);
    }
    await supabase
      .from("bling_sync_execucoes")
      .update({
        status: erroAcademy ? "erro" : "ok",
        erro: erroAcademy ? `Vendas do Academy: ${erroAcademy}` : null,
        resumo: { ...resultado },
        terminado_em: new Date().toISOString(),
      })
      .eq("id", id);
    return resultado;
  } catch (erro) {
    await supabase
      .from("bling_sync_execucoes")
      .update({ status: "erro", erro: erro instanceof Error ? erro.message : String(erro), terminado_em: new Date().toISOString() })
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

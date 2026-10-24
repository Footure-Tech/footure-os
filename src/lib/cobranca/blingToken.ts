// Token do Bling para a régua de cobrança e a baixa automática, sem disputar a
// renovação com a sincronização (ver comentário da função).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { obterAccessTokenValido } from "@/lib/integracoes/bling";

type Supa = SupabaseClient<Database>;

/**
 * Token do Bling sem disputar a renovação com a sincronização: o Bling
 * invalida o refresh_token anterior a cada renovação (ver 0053). Token ainda
 * válido é usado direto; vencido, só renova se não houver sincronização
 * rodando. null = seguir só com o cache.
 */
export async function tokenBlingSeguro(supabase: Supa): Promise<string | null> {
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

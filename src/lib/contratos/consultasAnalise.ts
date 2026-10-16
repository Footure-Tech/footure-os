import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

/** Análise da versão (0041) com as mudanças em ordem; null se a versão não tem análise (ex.: v1 gerada). */
export async function carregarAnaliseVersao(supabase: Supa, contratoId: string) {
  const { data: analise, error } = await supabase
    .from("contrato_analises")
    .select("id, status, resumo, resumo_ia, erro, base_contrato_id, contratos!contrato_analises_base_contrato_id_fkey(versao)")
    .eq("contrato_id", contratoId)
    .maybeSingle();
  if (error || !analise) return null;
  const { data: mudancas } = await supabase.from("contrato_mudancas").select("*").eq("analise_id", analise.id).order("ordem");
  return {
    ...analise,
    versaoBase: (analise.contratos as unknown as { versao: number } | null)?.versao ?? null,
    mudancas: mudancas ?? [],
  };
}

export type AnaliseVersao = NonNullable<Awaited<ReturnType<typeof carregarAnaliseVersao>>>;

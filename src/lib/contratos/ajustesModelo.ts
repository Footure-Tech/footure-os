// Ajustes do modelo de contrato (0041) agregados pelo jurídico — lidos na
// geração e aplicados como troca exata de trecho (ver gerarContrato).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AjusteModelo } from "./gerarContrato";

type Supa = SupabaseClient<Database>;

export async function carregarAjustesModelo(supabase: Supa, perfil: "clube" | "agente"): Promise<AjusteModelo[]> {
  const { data, error } = await supabase
    .from("modelo_contrato_ajustes")
    .select("id, trecho_original, trecho_novo")
    .eq("perfil", perfil)
    .eq("ativo", true)
    .order("criado_em");
  // Sem a tabela (migration não aplicada) ou sem permissão: gera o modelo padrão.
  if (error) {
    console.error("[contrato] ajustes do modelo não carregados:", error.message);
    return [];
  }
  return (data ?? []).map((a) => ({ id: a.id, de: a.trecho_original, para: a.trecho_novo }));
}

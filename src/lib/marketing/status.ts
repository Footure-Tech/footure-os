// Situação do módulo de Marketing para a Diretoria (card em Configurações):
// credenciais, última execução de cada fonte/conta, funis e campos do Kommo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SyncExecucaoRow } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

export async function carregarStatusMarketing(supabase: Supa) {
  const [{ data: config, error }, { data: contas }, { data: funis }, { data: execucoes }, { count: leads }] = await Promise.all([
    supabase.from("mkt_configuracao").select("*").eq("id", true).maybeSingle(),
    supabase.from("mkt_contas").select("*").order("bu"),
    supabase.from("mkt_kommo_funis").select("*").order("nome"),
    supabase.from("mkt_sync_execucoes").select("*").order("iniciado_em", { ascending: false }).limit(12),
    supabase.from("mkt_kommo_leads").select("*", { count: "exact", head: true }),
  ]);
  // Última execução de cada fonte/conta, e a da carga do histórico.
  const ultima = new Map<string, SyncExecucaoRow>();
  for (const e of execucoes ?? []) if (!ultima.has(`${e.fonte}:${e.conta ?? ""}`)) ultima.set(`${e.fonte}:${e.conta ?? ""}`, e);
  return {
    instalado: !error && !!config,
    config,
    contas: contas ?? [],
    funis: funis ?? [],
    execucoes: execucoes ?? [],
    ultimaPorFonte: ultima,
    totalLeads: leads ?? 0,
    credenciais: {
      meta: !!process.env.META_ACCESS_TOKEN,
      kommo: !!process.env.KOMMO_SUBDOMAIN && !!process.env.KOMMO_TOKEN,
      cron: !!process.env.CRON_SECRET,
    },
  };
}

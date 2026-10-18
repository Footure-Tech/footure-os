// Verificação de ponta a ponta do rastreio de uma campanha (0050): o sistema
// gera um link de teste com os IDs reais (campanha, conjunto e anúncio de maior
// gasto) e um código; a pessoa abre o link, preenche o formulário com o código
// no nome/e-mail e clica em "Verificar agora" — o sistema procura o lead no
// Kommo pelo código e confere campo a campo (rastreio.ts). O status final fica
// gravado; uma nova verificação cria outra linha (a mais recente vale).
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buscarLeadDeTesteKommo } from "@/lib/integracoes/kommo";
import { CAMPOS_PONTA_A_PONTA, conferirLead, PARAMETROS_META, statusDoResultado, type ChaveCampo, type ResultadoCampo } from "./rastreio";

type Supa = SupabaseClient<Database>;

export interface VerificacaoRastreio {
  id: string;
  codigo: string;
  urlTeste: string;
  status: "aguardando" | "ok" | "problema";
  resultado: ResultadoCampo[] | null;
  leadId: number | null;
  criadoEm: string;
  verificadoEm: string | null;
  autor: string | null;
  anuncio: string | null;
}

/** Nome e e-mail que a pessoa preenche no formulário de teste (o código identifica o lead). */
export const nomeTeste = (codigo: string) => `Teste Rastreio ${codigo}`;
export const emailTeste = (codigo: string) => `rastreio+${codigo.toLowerCase()}@footure.com.br`;

/** Abre uma verificação: link de teste com os IDs reais do anúncio ativo de maior gasto. */
export async function iniciarVerificacao(supabase: Supa, chaveCampanha: string, usuarioId: string) {
  const [accountId, campaignId] = chaveCampanha.split(":");
  const [{ data: dias }, { data: criativos }] = await Promise.all([
    supabase.from("mkt_meta_anuncio_dia").select("ad_id, ad_name, adset_id, adset_name, campaign_name, spend").eq("account_id", accountId).eq("campaign_id", campaignId),
    supabase.from("mkt_meta_criativos").select("ad_id, urls_destino, status_anuncio, url_tags").eq("account_id", accountId),
  ]);
  const gasto = new Map<string, { gasto: number; nome: string | null; adset: string | null; adsetNome: string | null; campanhaNome: string | null }>();
  for (const d of dias ?? []) {
    const g = gasto.get(d.ad_id) ?? { gasto: 0, nome: d.ad_name, adset: d.adset_id, adsetNome: d.adset_name, campanhaNome: d.campaign_name };
    g.gasto += Number(d.spend);
    gasto.set(d.ad_id, g);
  }
  const criativo = new Map((criativos ?? []).map((c) => [c.ad_id, c]));
  const candidatos = [...gasto]
    .filter(([id]) => criativo.get(id)?.urls_destino?.length)
    .sort(([a, x], [b, y]) => Number(criativo.get(b)?.status_anuncio === "ACTIVE") - Number(criativo.get(a)?.status_anuncio === "ACTIVE") || y.gasto - x.gasto);
  const [adId, info] = candidatos[0] ?? [];
  if (!adId || !info) throw new Error("Nenhum anúncio desta campanha com página de destino conhecida — sincronize o Marketing e tente de novo.");
  const destino = criativo.get(adId)!.urls_destino![0];

  const codigo = randomBytes(3).toString("hex").toUpperCase(); // ex.: 4F9A2C
  // O link reproduz os "Parâmetros de URL" reais do anúncio, com as variáveis
  // da Meta trocadas pelos valores reais (sem parâmetros, usa a convenção padrão).
  const macros: Record<string, string> = {
    "campaign.id": campaignId,
    "adset.id": info.adset ?? "",
    "ad.id": adId,
    "campaign.name": info.campanhaNome ?? "",
    "adset.name": info.adsetNome ?? "",
    "ad.name": info.nome ?? "",
    site_source_name: "fb",
    placement: "Facebook_Mobile_Feed",
  };
  const tags = criativo.get(adId)!.url_tags?.trim() || PARAMETROS_META;
  const url = new URL(destino);
  for (const par of tags.replace(/^\?/, "").split("&")) {
    const [k, v = ""] = par.split("=");
    if (!k) continue;
    url.searchParams.set(k.trim(), v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, m: string) => macros[m] ?? "").trim());
  }
  // Esperado no lead: o que a URL leva nos campos utm_* + os IDs nos campos que o sistema lê.
  const daUrl = (k: string) => url.searchParams.get(k) || undefined;
  const esperado: Partial<Record<ChaveCampo, string>> = {
    utm_source: daUrl("utm_source"),
    utm_medium: daUrl("utm_medium"),
    utm_campaign: daUrl("utm_campaign"),
    utm_term: daUrl("utm_term"),
    utm_content: daUrl("utm_content"),
    utm_campaign_id: campaignId,
    utm_ad_id: adId,
    ftp_utm_campaign: campaignId,
  };
  for (const k of Object.keys(esperado) as ChaveCampo[]) if (esperado[k] === undefined) delete esperado[k];

  const { data, error } = await supabase
    .from("mkt_verificacoes_rastreio")
    .insert({ campanha_chave: chaveCampanha, codigo, url_teste: url.toString(), esperado: { ...esperado, anuncio: info.nome }, criado_por: usuarioId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Não foi possível iniciar a verificação: ${error?.message}`);
  return data.id;
}

/** Procura o lead de teste no Kommo e grava o resultado; sem lead ainda, continua "aguardando". */
export async function verificarAgora(supabase: Supa, verificacaoId: string): Promise<{ encontrado: boolean; status: VerificacaoRastreio["status"] }> {
  const { data: v } = await supabase.from("mkt_verificacoes_rastreio").select("*").eq("id", verificacaoId).single();
  if (!v) throw new Error("Verificação não encontrada.");
  const lead = await buscarLeadDeTesteKommo(v.codigo);
  if (!lead) return { encontrado: false, status: "aguardando" };
  const recebido = Object.fromEntries(CAMPOS_PONTA_A_PONTA.map((c) => [c.chave, c.ids.map((id) => lead.campos.get(id)).find(Boolean) ?? null])) as Record<ChaveCampo, string | null>;
  const resultado = conferirLead(recebido, v.esperado as Partial<Record<ChaveCampo, string>>);
  const status = statusDoResultado(resultado);
  const { error } = await supabase
    .from("mkt_verificacoes_rastreio")
    .update({ status, resultado, lead_id: lead.leadId, verificado_em: new Date().toISOString() })
    .eq("id", verificacaoId);
  if (error) throw new Error(`Não foi possível gravar o resultado: ${error.message}`);
  return { encontrado: true, status };
}

/** Histórico de verificações da campanha (mais recente primeiro — é o status atual). */
export async function carregarVerificacoes(supabase: Supa, chaveCampanha: string): Promise<VerificacaoRastreio[]> {
  const [{ data }, { data: perfis }] = await Promise.all([
    supabase.from("mkt_verificacoes_rastreio").select("*").eq("campanha_chave", chaveCampanha).order("criado_em", { ascending: false }).limit(20),
    supabase.from("profiles").select("user_id, nome"),
  ]);
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  return (data ?? []).map((v) => ({
    id: v.id,
    codigo: v.codigo,
    urlTeste: v.url_teste,
    status: v.status,
    resultado: (v.resultado as ResultadoCampo[] | null) ?? null,
    leadId: v.lead_id,
    criadoEm: v.criado_em,
    verificadoEm: v.verificado_em,
    autor: v.criado_por ? (nome.get(v.criado_por) ?? null) : null,
    anuncio: ((v.esperado as { anuncio?: string } | null)?.anuncio ?? null) as string | null,
  }));
}

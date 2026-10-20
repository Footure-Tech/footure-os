// Kommo (CRM) — funis, etapas e leads para o módulo de Marketing. Porte de
// marketing/kommo_pull.py: MQL detectado por funil (etapa com "mql" no nome),
// venda = 142, perdida = 143, receita = price com "Valor Total" como
// alternativa e chaves de atribuição numéricas (utm_ad_id → utm_content,
// utm_campaign_id). Só busca e normaliza; quem grava é
// src/lib/marketing/sincronizacao.ts. KOMMO_SUBDOMAIN e KOMMO_TOKEN em env.
import type { KommoCampos } from "@/lib/supabase/database.types";

export const STATUS_GANHO = 142;
export const STATUS_PERDIDO = 143;

export class ErroKommo extends Error {}

/** Subdomínio limpo ("footure" de "https://footure.kommo.com/") e token sem aspas curvas (como no script). */
function credenciais() {
  let sub = (process.env.KOMMO_SUBDOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (sub.includes(".kommo.com")) sub = sub.split(".kommo.com")[0].split("/").pop() ?? "";
  const token = (process.env.KOMMO_TOKEN ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (!sub || !token) throw new ErroKommo("KOMMO_SUBDOMAIN e KOMMO_TOKEN não configurados.");
  if (!/^[\x20-\x7e]+$/.test(token)) throw new ErroKommo("KOMMO_TOKEN tem caractere inválido (provável aspa curva do copiar/colar).");
  return { base: `https://${sub}.kommo.com/api/v4`, token };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET com retry: 429 espera 2^t s; erro de rede 2^t × 3 s; 204 = sem conteúdo (null). */
async function getKommo<T>(caminho: string, params?: Record<string, string | number>): Promise<T | null> {
  const { base, token } = credenciais();
  const url = `${base}${caminho}${params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ""}`;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "footure-os/1.0" }, cache: "no-store" });
    } catch {
      await esperar(2 ** tentativa * 3000);
      continue;
    }
    if (resposta.status === 204) return null;
    if (resposta.status === 429) {
      await esperar(2 ** tentativa * 1000);
      continue;
    }
    if (!resposta.ok) throw new ErroKommo(`Erro Kommo ${resposta.status} em ${caminho}: ${(await resposta.text()).slice(0, 300)}`);
    return (await resposta.json()) as T;
  }
  throw new ErroKommo(`Kommo: falhou após várias tentativas em ${caminho}.`);
}

export interface EtapaKommo {
  pipeline_id: number;
  status_id: number;
  nome: string;
  sort: number;
  eh_mql: boolean;
}

export interface FunilKommo {
  pipeline_id: number;
  nome: string;
  etapas: EtapaKommo[];
}

export async function buscarFunisKommo(): Promise<FunilKommo[]> {
  const data = await getKommo<{
    _embedded?: { pipelines?: Array<{ id: number; name: string; _embedded?: { statuses?: Array<{ id: number; name: string; sort?: number }> } }> };
  }>("/leads/pipelines");
  return (data?._embedded?.pipelines ?? []).map((p) => ({
    pipeline_id: p.id,
    nome: p.name,
    etapas: (p._embedded?.statuses ?? []).map((s) => ({
      pipeline_id: p.id,
      status_id: s.id,
      nome: s.name,
      sort: s.sort ?? 0,
      eh_mql: /mql/i.test(s.name ?? ""),
    })),
  }));
}

/** Campos personalizados de lead (descoberta dos IDs de ftp_utm_campaign e landing_page). */
export async function buscarCamposLeadKommo(): Promise<Array<{ id: number; nome: string; code: string | null }>> {
  const campos: Array<{ id: number; nome: string; code: string | null }> = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getKommo<{ _embedded?: { custom_fields?: Array<{ id: number; name: string; code?: string | null }> } }>("/leads/custom_fields", { limit: 250, page });
    const lista = data?._embedded?.custom_fields ?? [];
    campos.push(...lista.map((c) => ({ id: c.id, nome: c.name, code: c.code ?? null })));
    if (lista.length < 250) break;
  }
  return campos;
}

interface LeadBruto {
  id: number;
  pipeline_id?: number;
  status_id?: number;
  price?: number | null;
  created_at?: number;
  closed_at?: number | null;
  updated_at?: number;
  custom_fields_values?: Array<{ field_id: number; values?: Array<{ value?: unknown }> }> | null;
}

export interface LeadNormalizado {
  lead_id: number;
  pipeline_id: number | null;
  status_id: number | null;
  ad_id: string | null;
  ad_name_raw: string | null;
  campaign_id: string | null;
  ftp_campaign_id: string | null;
  is_mql: boolean;
  is_won: boolean;
  is_lost: boolean;
  revenue: number;
  criado_em: string | null;
  fechado_em: string | null;
  atualizado_em: string | null;
  dias_ate_venda: number | null;
}

const campo = (lead: LeadBruto, id: number | null) =>
  id === null ? "" : String(lead.custom_fields_values?.find((c) => c.field_id === id)?.values?.[0]?.value ?? "").trim();
const numerico = (v: string) => /^\d+$/.test(v);

/** utm_content da URL de entrada (landing_page): o anúncio do primeiro toque. */
function adDaLandingPage(url: string): string {
  try {
    return new URL(url).searchParams.get("utm_content")?.trim() ?? "";
  } catch {
    return "";
  }
}
const isoDeEpoch = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

/**
 * Normaliza um lead (porte de pull()): MQL = ganho, ou etapa atual com sort ≥
 * sort da etapa MQL do funil; perdido nunca é MQL (regra de domínio —
 * limitação: quem passou por MQL e foi perdido conta como não-MQL).
 */
export function normalizarLead(lead: LeadBruto, campos: KommoCampos, sortDe: Map<string, number>, sortMql: Map<number, number>): LeadNormalizado {
  const pid = lead.pipeline_id ?? null;
  const status = lead.status_id ?? null;
  const ganho = status === STATUS_GANHO;
  const perdido = status === STATUS_PERDIDO;
  const limiar = pid !== null ? sortMql.get(pid) : undefined;
  const atual = sortDe.get(`${pid}:${status}`) ?? 0;
  const mql = ganho ? true : perdido ? false : limiar !== undefined && atual >= limiar;

  // Desde ~20/09 a maioria dos leads chega sem as UTMs de último toque; o
  // anúncio então vem da URL de entrada do primeiro toque (só como último recurso).
  const valoresAd = [campo(lead, campos.utm_ad_id), campo(lead, campos.utm_content), adDaLandingPage(campo(lead, campos.landing_page ?? null))];
  const campanha = campo(lead, campos.utm_campaign_id);
  const ftp = campo(lead, campos.ftp_utm_campaign);
  let receita = Number(lead.price ?? 0) || 0;
  if (!receita) {
    const vt = campo(lead, campos.valor_total).replace(",", ".");
    receita = /^\d+(\.\d+)?$/.test(vt) ? Number(vt) : 0;
  }
  const dias = ganho && lead.closed_at && lead.created_at ? Math.round(((lead.closed_at - lead.created_at) / 86400) * 10) / 10 : null;

  return {
    lead_id: lead.id,
    pipeline_id: pid,
    status_id: status,
    ad_id: valoresAd.find(numerico) ?? null,
    ad_name_raw: valoresAd.find((v) => v && !numerico(v)) ?? null,
    campaign_id: numerico(campanha) ? campanha : null,
    ftp_campaign_id: numerico(ftp) ? ftp : null,
    is_mql: mql,
    is_won: ganho,
    is_lost: perdido,
    revenue: receita,
    criado_em: isoDeEpoch(lead.created_at),
    fechado_em: isoDeEpoch(lead.closed_at),
    atualizado_em: isoDeEpoch(lead.updated_at),
    dias_ate_venda: dias,
  };
}

/**
 * Uma página de leads (250), filtrando por criação (backfill) ou atualização
 * (incremental — pega mudança de status de lead antigo). Devolve null quando
 * acabou. Pausa de 200 ms entre páginas fica a cargo de quem chama.
 */
export async function buscarPaginaLeadsKommo(pagina: number, filtro: { campo: "created_at" | "updated_at"; desde: number }): Promise<LeadBruto[] | null> {
  const data = await getKommo<{ _embedded?: { leads?: LeadBruto[] } }>("/leads", {
    limit: 250,
    page: pagina,
    [`filter[${filtro.campo}][from]`]: filtro.desde,
  });
  const leads = data?._embedded?.leads ?? [];
  return leads.length ? leads : null;
}

/**
 * Lead de teste da verificação de rastreio: procura o contato pelo código (no
 * nome ou e-mail preenchido no formulário) e devolve o lead mais recente dele,
 * com os campos personalizados por id.
 */
export async function buscarLeadDeTesteKommo(codigo: string): Promise<{ leadId: number; criadoEm: string; campos: Map<number, string> } | null> {
  const contatos = await getKommo<{ _embedded?: { contacts?: Array<{ id: number; _embedded?: { leads?: Array<{ id: number }> } }> } }>("/contacts", {
    query: codigo,
    with: "leads",
    limit: 10,
  });
  const ids = [...new Set((contatos?._embedded?.contacts ?? []).flatMap((c) => (c._embedded?.leads ?? []).map((l) => l.id)))];
  if (!ids.length) return null;
  const leads: LeadBruto[] = [];
  for (const id of ids.slice(0, 5)) {
    const lead = await getKommo<LeadBruto>(`/leads/${id}`);
    if (lead) leads.push(lead);
  }
  const maisRecente = leads.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0];
  if (!maisRecente) return null;
  const campos = new Map<number, string>();
  for (const c of maisRecente.custom_fields_values ?? []) {
    const v = String(c.values?.[0]?.value ?? "").trim();
    if (v) campos.set(c.field_id, v);
  }
  return { leadId: maisRecente.id, criadoEm: new Date((maisRecente.created_at ?? 0) * 1000).toISOString(), campos };
}

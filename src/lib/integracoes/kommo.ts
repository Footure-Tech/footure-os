// Kommo (CRM) — funis, etapas e leads para o módulo de Marketing. Porte de
// marketing/kommo_pull.py: MQL detectado por funil (etapa com "mql" no nome),
// venda = 142, perdida = 143, receita = price com "Valor Total" como
// alternativa e chaves de atribuição numéricas (utm_ad_id → utm_content,
// utm_campaign_id). Também motivo de perda, responsável, tags e os movimentos
// entre etapas (visão Funil, 0054). Só busca e normaliza; quem grava é
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

/** Link do lead no Kommo (para abrir direto da tela). */
export function urlLeadKommo(leadId: number) {
  return `${credenciais().base.replace("/api/v4", "")}/leads/detail/${leadId}`;
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
  responsible_user_id?: number | null;
  custom_fields_values?: Array<{ field_id: number; values?: Array<{ value?: unknown }> }> | null;
  _embedded?: { loss_reason?: Array<{ id: number }>; tags?: Array<{ name?: string }> };
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
  loss_reason_id: number | null;
  responsavel_id: number | null;
  tags: string[] | null;
  adset_id: string | null;
  utm_source: string | null;
}

const campo = (lead: LeadBruto, id: number | null | undefined) =>
  id == null ? "" : String(lead.custom_fields_values?.find((c) => c.field_id === id)?.values?.[0]?.value ?? "").trim();
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
  const adset = campo(lead, campos.utm_adset_id);
  const tags = (lead._embedded?.tags ?? []).map((t) => t.name?.trim() ?? "").filter(Boolean);
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
    loss_reason_id: perdido ? (lead._embedded?.loss_reason?.[0]?.id ?? null) : null,
    responsavel_id: lead.responsible_user_id || null,
    tags: tags.length ? tags : null,
    adset_id: numerico(adset) ? adset : null,
    utm_source: campo(lead, campos.utm_source).toLowerCase() || null,
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
    with: "loss_reason",
    [`filter[${filtro.campo}][from]`]: filtro.desde,
  });
  const leads = data?._embedded?.leads ?? [];
  return leads.length ? leads : null;
}

/** Motivos de perda cadastrados (Falta de Conexão, Fora do Perfil…). */
export async function buscarMotivosPerdaKommo(): Promise<Array<{ id: number; nome: string; sort: number }>> {
  const data = await getKommo<{ _embedded?: { loss_reasons?: Array<{ id: number; name: string; sort?: number }> } }>("/leads/loss_reasons");
  return (data?._embedded?.loss_reasons ?? []).map((m) => ({ id: m.id, nome: m.name, sort: m.sort ?? 0 }));
}

/** Usuários da conta (responsável pelo lead). */
export async function buscarUsuariosKommo(): Promise<Array<{ id: number; nome: string; ativo: boolean }>> {
  const data = await getKommo<{ _embedded?: { users?: Array<{ id: number; name: string; rights?: { is_active?: boolean } }> } }>("/users", { limit: 250 });
  return (data?._embedded?.users ?? []).map((u) => ({ id: u.id, nome: u.name, ativo: u.rights?.is_active ?? true }));
}

export interface MovimentoKommo {
  evento_id: string;
  lead_id: number;
  criado_em: string;
  pipeline_de: number | null;
  status_de: number | null;
  pipeline_para: number | null;
  status_para: number | null;
  autor_id: number | null;
}

type StatusDoEvento = Array<{ lead_status?: { id?: number; pipeline_id?: number } }> | undefined;

/**
 * Uma página (100) de mudanças de etapa de lead criadas na janela [de, ate]
 * (epoch s). O Kommo devolve do mais recente para o mais antigo: a janela
 * precisa estar fechada no passado para a paginação ser estável (o incremental
 * relê a margem e o upsert pelo id do evento evita duplicar). null = acabou.
 */
export async function buscarPaginaMovimentosKommo(pagina: number, de: number, ate: number): Promise<MovimentoKommo[] | null> {
  const data = await getKommo<{
    _embedded?: { events?: Array<{ id: string; entity_id: number; created_at: number; created_by?: number; value_before?: StatusDoEvento; value_after?: StatusDoEvento }> };
  }>("/events", {
    limit: 100,
    page: pagina,
    "filter[type]": "lead_status_changed",
    "filter[entity]": "lead",
    "filter[created_at][from]": de,
    "filter[created_at][to]": ate,
  });
  const eventos = data?._embedded?.events ?? [];
  if (!eventos.length) return null;
  return eventos.map((e) => {
    const antes = e.value_before?.[0]?.lead_status;
    const depois = e.value_after?.[0]?.lead_status;
    return {
      evento_id: String(e.id),
      lead_id: e.entity_id,
      criado_em: new Date(e.created_at * 1000).toISOString(),
      pipeline_de: antes?.pipeline_id ?? null,
      status_de: antes?.id ?? null,
      pipeline_para: depois?.pipeline_id ?? null,
      status_para: depois?.id ?? null,
      autor_id: e.created_by ?? null,
    };
  });
}

export interface MensagemKommo {
  evento_id: string;
  lead_id: number;
  criado_em: string;
  entrada: boolean;
  autor_id: number | null;
  origem: string | null;
  talk_id: number | null;
}

/**
 * Uma página (100) de mensagens de chat (WhatsApp/Instagram) recebidas ou
 * enviadas na janela [de, ate] (epoch s), só as ligadas a lead. Um tipo por
 * chamada: o filtro de vários tipos (ou por entidade) não traz as mensagens.
 * Mesma regra de paginação dos movimentos. null = acabou.
 */
export async function buscarPaginaMensagensKommo(pagina: number, direcao: "entrada" | "saida", de: number, ate: number): Promise<MensagemKommo[] | null> {
  const data = await getKommo<{
    _embedded?: {
      events?: Array<{ id: string; entity_id: number; entity_type: string; created_at: number; created_by?: number; value_after?: Array<{ message?: { origin?: string; talk_id?: number } }> }>;
    };
  }>("/events", {
    limit: 100,
    page: pagina,
    "filter[type]": direcao === "entrada" ? "incoming_chat_message" : "outgoing_chat_message",
    "filter[created_at][from]": de,
    "filter[created_at][to]": ate,
  });
  const eventos = data?._embedded?.events ?? [];
  if (!eventos.length) return null;
  return eventos
    .filter((e) => e.entity_type === "lead")
    .map((e) => ({
      evento_id: String(e.id),
      lead_id: e.entity_id,
      criado_em: new Date(e.created_at * 1000).toISOString(),
      entrada: direcao === "entrada",
      autor_id: e.created_by ?? null,
      origem: e.value_after?.[0]?.message?.origin ?? null,
      talk_id: e.value_after?.[0]?.message?.talk_id ?? null,
    }));
}

/**
 * Notas comuns (texto livre do vendedor) dos leads, em lotes de 50 ids, 4
 * lotes por vez (o Kommo aceita ~7 requisições/s). Fonte das objeções nas
 * Estratégias por IA da aba Funil.
 */
export async function buscarNotasLeadsKommo(leadIds: number[]): Promise<Array<{ lead_id: number; texto: string; criado_em: string }>> {
  const notas: Array<{ lead_id: number; texto: string; criado_em: string }> = [];
  const lotes: number[][] = [];
  for (let i = 0; i < leadIds.length; i += 50) lotes.push(leadIds.slice(i, i + 50));
  const lerLote = async (ids: number[]) => {
    const filtro = Object.fromEntries(ids.map((id, n) => [`filter[entity_id][${n}]`, id]));
    for (let page = 1; page <= 10; page++) {
      const data = await getKommo<{ _embedded?: { notes?: Array<{ entity_id: number; note_type: string; created_at: number; params?: { text?: string } }> } }>("/leads/notes", {
        limit: 250,
        page,
        "filter[note_type][0]": "common",
        ...filtro,
      });
      const lista = data?._embedded?.notes ?? [];
      for (const n of lista) {
        const texto = (n.params?.text ?? "").trim();
        if (texto) notas.push({ lead_id: n.entity_id, texto, criado_em: new Date(n.created_at * 1000).toISOString() });
      }
      if (lista.length < 250) break;
    }
  };
  for (let i = 0; i < lotes.length; i += 4) await Promise.all(lotes.slice(i, i + 4).map(lerLote));
  return notas;
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

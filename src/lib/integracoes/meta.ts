// Meta Marketing API — insights diários de mídia paga (módulo de Marketing).
// Porte de marketing/meta_ads_pull.py (implementação de referência): leitura
// de actions/cost_per_action_type nas janelas 7d_click + 1d_view, nível
// campanha (ano inteiro, leve) ou anúncio (janela recente, ranking de
// criativos) e o backoff por código de erro. Só busca e normaliza; quem grava
// é src/lib/marketing/sincronizacao.ts. Token de System User em
// META_ACCESS_TOKEN (env); as contas ficam em mkt_contas.

const API_BASE = "https://graph.facebook.com";
const versao = () => process.env.META_API_VERSION || "v26.0";

/** Janelas de atribuição: "clique de 7 dias, visualização de 1 dia". */
const JANELAS = ["7d_click", "1d_view"] as const;
const ACOES = { leads: "offsite_conversion.fb_pixel_lead", purchases: "offsite_conversion.fb_pixel_purchase" } as const;

const CAMPOS_CAMPANHA = ["date_start", "campaign_id", "campaign_name", "spend", "impressions", "frequency", "actions", "cost_per_action_type"];
const CAMPOS_ANUNCIO = [...CAMPOS_CAMPANHA, "adset_id", "adset_name", "ad_id", "ad_name"];

export type NivelMeta = "campaign" | "ad";

interface Acao {
  action_type?: string;
  value?: string;
  [janela: string]: string | undefined;
}

interface InsightBruto {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  frequency?: string;
  actions?: Acao[];
}

export interface LinhaMeta {
  dia: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  spend: number;
  impressions: number;
  frequency: number;
  leads: number;
  purchases: number;
  actions_raw: Acao[];
}

export class ErroMeta extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: number,
  ) {
    super(mensagem);
  }
}

export function tokenMeta() {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new ErroMeta("META_ACCESS_TOKEN não configurado.");
  return token;
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Valor da ação nas janelas pedidas: `value` (total) ou a soma das janelas. */
function extrairAcao(acoes: Acao[] | undefined, tipo: string) {
  const a = acoes?.find((x) => x.action_type === tipo);
  if (!a) return 0;
  if (a.value !== undefined) return num(a.value);
  return JANELAS.reduce((s, j) => s + num(a[j]), 0);
}

export function normalizarInsight(bruto: InsightBruto): LinhaMeta {
  return {
    dia: bruto.date_start ?? "",
    campaign_id: bruto.campaign_id ?? "",
    campaign_name: bruto.campaign_name ?? null,
    adset_id: bruto.adset_id ?? null,
    adset_name: bruto.adset_name ?? null,
    ad_id: bruto.ad_id ?? null,
    ad_name: bruto.ad_name ?? null,
    spend: num(bruto.spend),
    impressions: Math.round(num(bruto.impressions)),
    frequency: num(bruto.frequency),
    leads: extrairAcao(bruto.actions, ACOES.leads),
    purchases: extrairAcao(bruto.actions, ACOES.purchases),
    // Guardado para auditoria e eventos que ainda não mapeamos.
    actions_raw: bruto.actions ?? [],
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com backoff (porte de _get): 4 (app), 17 (usuário), 32/613 (throttle) e
 * ≥ 80000 (insights) esperam 2^tentativa × 15 s; erro de rede, 2^t × 5 s; até 5
 * tentativas. Qualquer outro erro lança ErroMeta (interrompe só aquela conta/fatia).
 */
async function getMeta<T>(url: string): Promise<T> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(url, { headers: { "User-Agent": "footure-os/1.0" }, cache: "no-store" });
    } catch {
      await esperar(2 ** tentativa * 5000);
      continue;
    }
    const json = (await resposta.json().catch(() => ({}))) as { error?: { code?: number; message?: string } } & T;
    if (resposta.ok) return json;
    const codigo = json.error?.code;
    if (codigo !== undefined && ([4, 17, 32, 613].includes(codigo) || codigo >= 80000)) {
      await esperar(2 ** tentativa * 15000);
      continue;
    }
    throw new ErroMeta(`Erro da API Meta (code ${codigo ?? resposta.status}): ${json.error?.message ?? resposta.statusText}`, codigo);
  }
  throw new ErroMeta("Meta: falhou após várias tentativas (limite de requisições ou rede).");
}

/** Insights diários (time_increment=1) de uma conta, paginados. */
export async function buscarInsightsMeta(accountId: string, de: string, ate: string, nivel: NivelMeta): Promise<LinhaMeta[]> {
  const params = new URLSearchParams({
    level: nivel,
    time_increment: "1",
    fields: (nivel === "ad" ? CAMPOS_ANUNCIO : CAMPOS_CAMPANHA).join(","),
    action_attribution_windows: JSON.stringify(JANELAS),
    time_range: JSON.stringify({ since: de, until: ate }),
    limit: "200",
    access_token: tokenMeta(),
  });
  let url: string | undefined = `${API_BASE}/${versao()}/${accountId}/insights?${params}`;
  const linhas: LinhaMeta[] = [];
  while (url) {
    const pagina: { data?: InsightBruto[]; paging?: { next?: string } } = await getMeta(url);
    linhas.push(...(pagina.data ?? []).map(normalizarInsight));
    url = pagina.paging?.next;
  }
  return linhas;
}

/**
 * Miniatura do criativo de cada anúncio (vídeo também tem). O link da Meta
 * expira em poucos dias — quem chama baixa a imagem e guarda no Storage.
 * Lista os anúncios da conta filtrando pelos ids, em lotes de 50 (a v26 não
 * aceita mais o parâmetro `ids`).
 */
export async function buscarMiniaturasMeta(accountId: string, adIds: string[]): Promise<Array<{ adId: string; creativeId: string | null; url: string | null }>> {
  const saida: Array<{ adId: string; creativeId: string | null; url: string | null }> = [];
  for (let i = 0; i < adIds.length; i += 50) {
    const params = new URLSearchParams({
      fields: "id,creative{id,thumbnail_url}",
      filtering: JSON.stringify([{ field: "id", operator: "IN", value: adIds.slice(i, i + 50) }]),
      thumbnail_width: "320",
      thumbnail_height: "320",
      limit: "100",
      access_token: tokenMeta(),
    });
    let url: string | undefined = `${API_BASE}/${versao()}/${accountId}/ads?${params}`;
    while (url) {
      const pagina: { data?: Array<{ id: string; creative?: { id?: string; thumbnail_url?: string } }>; paging?: { next?: string } } = await getMeta(url);
      for (const ad of pagina.data ?? []) saida.push({ adId: ad.id, creativeId: ad.creative?.id ?? null, url: ad.creative?.thumbnail_url ?? null });
      url = pagina.paging?.next;
    }
  }
  return saida;
}

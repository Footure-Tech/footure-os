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
const ACOES = {
  leads: "offsite_conversion.fb_pixel_lead",
  purchases: "offsite_conversion.fb_pixel_purchase",
  // Topo do funil (0054).
  linkClicks: "link_click",
  landingPageViews: "landing_page_view",
  checkouts: "offsite_conversion.fb_pixel_initiate_checkout",
  videoViews: "video_view",
} as const;

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
  link_clicks: number;
  landing_page_views: number;
  checkouts: number;
  video_views: number;
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
    link_clicks: extrairAcao(bruto.actions, ACOES.linkClicks),
    landing_page_views: extrairAcao(bruto.actions, ACOES.landingPageViews),
    checkouts: extrairAcao(bruto.actions, ACOES.checkouts),
    video_views: extrairAcao(bruto.actions, ACOES.videoViews),
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
 * Imagem e páginas de destino de cada anúncio. Imagem para ilustrar o ranking: a ORIGINAL do criativo
 * (biblioteca de imagens da conta, pelo hash — ex.: 1080×1080) quando existe;
 * senão a miniatura (vídeos: o token não tem permissão para a capa grande).
 * Os links da Meta expiram em poucos dias — quem chama baixa e guarda no
 * Storage. Lista os anúncios da conta filtrando pelos ids, em lotes de 50 (a
 * v26 não aceita mais o parâmetro `ids`).
 */
export async function buscarImagensCriativosMeta(
  accountId: string,
  adIds: string[],
): Promise<Array<{ adId: string; creativeId: string | null; url: string | null; original: boolean; destinos: string[]; urlTags: string | null; status: string | null }>> {
  type Criativo = {
    id?: string;
    thumbnail_url?: string;
    image_hash?: string;
    link_url?: string;
    url_tags?: string;
    object_story_spec?: { link_data?: { link?: string }; video_data?: { call_to_action?: { value?: { link?: string } } } };
    asset_feed_spec?: { images?: Array<{ hash?: string }>; link_urls?: Array<{ website_url?: string; url_tags?: string }> };
  };
  type Anuncio = { id: string; effective_status?: string; adset?: { end_time?: string }; campaign?: { stop_time?: string }; creative?: Criativo };
  const anuncios: Anuncio[] = [];
  for (let i = 0; i < adIds.length; i += 50) {
    const params = new URLSearchParams({
      fields:
        "id,effective_status,adset{end_time},campaign{stop_time},creative{id,thumbnail_url,image_hash,link_url,url_tags,object_story_spec{link_data{link},video_data{call_to_action{value{link}}}},asset_feed_spec{images,link_urls{website_url,url_tags}}}",
      filtering: JSON.stringify([{ field: "id", operator: "IN", value: adIds.slice(i, i + 50) }]),
      thumbnail_width: "320",
      thumbnail_height: "320",
      limit: "100",
      access_token: tokenMeta(),
    });
    let url: string | undefined = `${API_BASE}/${versao()}/${accountId}/ads?${params}`;
    while (url) {
      const pagina: { data?: Anuncio[]; paging?: { next?: string } } = await getMeta(url);
      anuncios.push(...(pagina.data ?? []));
      url = pagina.paging?.next;
    }
  }

  // Original pelo hash da imagem (criativo simples ou o primeiro do criativo dinâmico).
  const hashDe = (c?: Criativo) => c?.image_hash ?? c?.asset_feed_spec?.images?.find((im) => im.hash)?.hash ?? null;
  const hashes = [...new Set(anuncios.map((a) => hashDe(a.creative)).filter((h): h is string => !!h))];
  const urlDoHash = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += 50) {
    const params = new URLSearchParams({ hashes: JSON.stringify(hashes.slice(i, i + 50)), fields: "hash,url", access_token: tokenMeta() });
    const resp: { data?: Array<{ hash?: string; url?: string }> } = await getMeta(`${API_BASE}/${versao()}/${accountId}/adimages?${params}`);
    for (const im of resp.data ?? []) if (im.hash && im.url) urlDoHash.set(im.hash, im.url);
  }

  // A Meta mantém ACTIVE no anúncio cujo conjunto/campanha já terminou (o
  // Gerenciador mostra "Concluído"): nesse caso grava EXPIRED (valor nosso).
  const agora = Date.now();
  const statusAnuncio = (a: Anuncio) => {
    const fim = [a.adset?.end_time, a.campaign?.stop_time].map((d) => (d ? Date.parse(d) : NaN)).filter((t) => !Number.isNaN(t));
    if (a.effective_status === "ACTIVE" && fim.some((t) => t < agora)) return "EXPIRED";
    return a.effective_status ?? null;
  };

  return anuncios.map((a) => {
    const original = urlDoHash.get(hashDe(a.creative) ?? "") ?? null;
    const c = a.creative;
    // Páginas de destino do anúncio (sem a query string; o anúncio dinâmico pode ter várias).
    const destinos = [c?.link_url, c?.object_story_spec?.link_data?.link, c?.object_story_spec?.video_data?.call_to_action?.value?.link, ...(c?.asset_feed_spec?.link_urls ?? []).map((l) => l.website_url)]
      .filter((u): u is string => !!u && /^https?:\/\//.test(u))
      .map((u) => u.split("?")[0]);
    // "Parâmetros de URL" do anúncio (no criativo dinâmico, os do primeiro link).
    const urlTags = c?.url_tags || c?.asset_feed_spec?.link_urls?.find((l) => l.url_tags)?.url_tags || null;
    return {
      adId: a.id,
      creativeId: c?.id ?? null,
      url: original ?? c?.thumbnail_url ?? null,
      original: !!original,
      destinos: [...new Set(destinos)],
      urlTags,
      status: statusAnuncio(a),
    };
  });
}

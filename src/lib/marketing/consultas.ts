// Visão A do Marketing — desempenho de campanhas e criativos
// (docs/modulo-marketing-spec.md §3.1, §4.3, §4.5). Lê só o banco (mkt_*).
// Atribuição por campanha (porte de dashboard.py): campaign_id do lead que
// existe no histórico da Meta → senão, a campanha do ad_id → senão, sem
// atribuição. CAC pelo primeiro toque pago (ftp_campaign_id), com a última
// campanha como alternativa. Receita na data de origem do lead (coorte, BRT).
// Por criativo (porte de meta_kommo_join.py): ad_id numérico (forte) → nome
// do criativo que corresponde a um único anúncio (recuperado) → fora.
// Leads de funis "fora" (Footure PRO, Insights) não entram em nenhuma BU.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuMarketing, Database, LimiaresMarketing } from "@/lib/supabase/database.types";
import { BUCKET_CRIATIVOS } from "./sincronizacao";
import { avaliarTagsAnuncio } from "./rastreio";
import { avaliarCriativo, maturidade, normalizarNome, ORDEM_ACAO, razao, recomendacoesCampanha, saturacao, type Acao } from "./motor";

type Supa = SupabaseClient<Database>;

export type PeriodoMarketing = "30d" | "90d" | "ano" | "tudo";
export const ROTULO_BU: Record<BuMarketing, string> = { academy: "Footure Academy", footlink: "Footlink" };

const hojeBrt = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diaBrt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : null);

export function intervaloMarketing(periodo: PeriodoMarketing, backfillDesde: string) {
  const ate = hojeBrt();
  if (periodo === "30d") return { de: somarDias(ate, -29), ate };
  if (periodo === "90d") return { de: somarDias(ate, -89), ate };
  if (periodo === "ano") return { de: `${ate.slice(0, 4)}-01-01`, ate };
  return { de: backfillDesde, ate };
}

async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await consulta(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Base comum: configuração, contas, funis, Meta (campanha e anúncio) e leads do Kommo. */
async function carregarBase(supabase: Supa) {
  const [{ data: config }, { data: contas }, { data: funis }, campanhas, anuncios, leads, { data: ultimas }] = await Promise.all([
    supabase.from("mkt_configuracao").select("*").eq("id", true).maybeSingle(),
    supabase.from("mkt_contas").select("*"),
    supabase.from("mkt_kommo_funis").select("pipeline_id, bu"),
    lerTudo((de, ate) => supabase.from("mkt_meta_campanha_dia").select("account_id, campaign_id, campaign_name, dia, spend, impressions, frequency, leads").range(de, ate)),
    lerTudo((de, ate) => supabase.from("mkt_meta_anuncio_dia").select("account_id, ad_id, ad_name, campaign_id, adset_name, dia, spend, impressions, frequency, leads").range(de, ate)),
    lerTudo((de, ate) =>
      supabase.from("mkt_kommo_leads").select("lead_id, pipeline_id, ad_id, ad_name_raw, campaign_id, ftp_campaign_id, is_mql, is_won, revenue, criado_em, dias_ate_venda").range(de, ate),
    ),
    supabase.from("mkt_sync_execucoes").select("fonte, conta, status, erro, terminado_em, iniciado_em").order("iniciado_em", { ascending: false }).limit(20),
  ]);
  if (!config) throw new Error("Módulo de Marketing sem configuração (migration 0047).");
  const buConta = new Map((contas ?? []).map((c) => [c.account_id, c.bu]));
  const buFunil = new Map((funis ?? []).map((f) => [f.pipeline_id, f.bu]));

  // Contexto de cada campanha (histórico completo) e de cada anúncio.
  const campanha = new Map<string, { chave: string; accountId: string; campaignId: string; nome: string; bu: BuMarketing }>();
  for (const c of campanhas) {
    const bu = buConta.get(c.account_id);
    if (bu) campanha.set(c.campaign_id, { chave: `${c.account_id}:${c.campaign_id}`, accountId: c.account_id, campaignId: c.campaign_id, nome: c.campaign_name ?? c.campaign_id, bu });
  }
  const campanhaDoAnuncio = new Map(anuncios.filter((a) => a.campaign_id).map((a) => [a.ad_id, a.campaign_id!]));

  const ctxLead = (l: (typeof leads)[number]) => {
    const ultimo = (l.campaign_id && campanha.get(l.campaign_id)) || (l.ad_id && campanhaDoAnuncio.has(l.ad_id) ? campanha.get(campanhaDoAnuncio.get(l.ad_id)!) : undefined);
    const primeiro = (l.ftp_campaign_id && campanha.get(l.ftp_campaign_id)) || ultimo;
    return { ultimo: ultimo ?? null, primeiro: primeiro ?? null };
  };

  const leadsValidos = leads
    .map((l) => ({ ...l, bu: buFunil.get(l.pipeline_id ?? -1) ?? "academy", dia: diaBrt(l.criado_em), revenue: Number(l.revenue) }))
    .filter((l) => l.bu !== "fora" && l.dia);
  const mat = maturidade(
    leadsValidos.filter((l) => l.is_won).map((l) => (l.dias_ate_venda === null ? null : Number(l.dias_ate_venda))),
    leadsValidos.map((l) => l.criado_em!).filter(Boolean),
  );

  // Último dado bom por fonte (faixa de status na tela).
  const ultimaOk = (ultimas ?? []).find((e) => e.status === "ok");
  const erro = (ultimas ?? []).find((e) => e.status === "erro" && (!ultimaOk || e.iniciado_em > ultimaOk.iniciado_em));

  return {
    limiares: config.limiares as LimiaresMarketing,
    backfillDesde: config.backfill_desde,
    contas: contas ?? [],
    campanhas,
    anuncios,
    campanha,
    leads: leadsValidos,
    ctxLead,
    mat,
    sincronizadoEm: ultimaOk?.terminado_em ?? null,
    erroSync: erro?.erro ?? null,
    temDados: campanhas.length > 0,
  };
}

export interface FiltroMarketing {
  periodo: PeriodoMarketing;
  bu: BuMarketing | "todas";
  campanha?: string | null; // "account:campaign"
}

export interface LinhaCampanha {
  chave: string;
  campaignId: string;
  nome: string;
  bu: BuMarketing;
  gasto: number;
  impressoes: number;
  frequencia: number | null;
  leadsMeta: number;
  leadsCrm: number;
  leadsMaduros: number;
  mql: number;
  vendas: number;
  vendasPrimeiroToque: number;
  receita: number;
  cplMeta: number | null;
  cplCrm: number | null;
  custoMql: number | null;
  cacTeto: number | null;
  roas: number | null;
  saturando: boolean;
  motivoSaturacao: string;
  jovem: boolean;
}

type Acumulado = { gasto: number; impr: number; freqW: number; leadsMeta: number; gastoIni: number; gastoFim: number; leadsIni: number; leadsFim: number };
const novoAcumulado = (): Acumulado => ({ gasto: 0, impr: 0, freqW: 0, leadsMeta: 0, gastoIni: 0, gastoFim: 0, leadsIni: 0, leadsFim: 0 });
function acumular(a: Acumulado, r: { spend: number; impressions: number; frequency: number; leads: number; dia: string }, meio: string) {
  const gasto = Number(r.spend);
  const impr = Number(r.impressions);
  const leads = Number(r.leads);
  a.gasto += gasto;
  a.impr += impr;
  a.freqW += Number(r.frequency) * impr;
  a.leadsMeta += leads;
  // Tendência de CPL: 1ª × 2ª metade do período filtrado (divisão pelo meio do período, não do item).
  if (r.dia < meio) {
    a.gastoIni += gasto;
    a.leadsIni += leads;
  } else {
    a.gastoFim += gasto;
    a.leadsFim += leads;
  }
}

/** Visão A, nível campanha: KPIs, linhas por campanha, cobertura e maturidade. */
export async function carregarDesempenho(supabase: Supa, filtro: FiltroMarketing) {
  const base = await carregarBase(supabase);
  const { de, ate } = intervaloMarketing(filtro.periodo, base.backfillDesde);
  const meio = somarDias(de, Math.floor((Date.parse(ate) - Date.parse(de)) / 86_400_000 / 2));
  const daBu = (bu: BuMarketing) => filtro.bu === "todas" || filtro.bu === bu;

  const meta = new Map<string, Acumulado>();
  for (const r of base.campanhas) {
    if (r.dia < de || r.dia > ate) continue;
    const ctx = base.campanha.get(r.campaign_id);
    if (!ctx || !daBu(ctx.bu)) continue;
    const a = meta.get(ctx.chave) ?? novoAcumulado();
    acumular(a, { ...r, spend: Number(r.spend), impressions: Number(r.impressions), frequency: Number(r.frequency), leads: Number(r.leads) }, meio);
    meta.set(ctx.chave, a);
  }

  type Crm = { leads: number; maduros: number; mql: number; vendas: number; receita: number; vendasPt: number };
  const crm = new Map<string, Crm>();
  const novoCrm = (): Crm => ({ leads: 0, maduros: 0, mql: 0, vendas: 0, receita: 0, vendasPt: 0 });
  let vendasTotais = 0;
  let vendasAtribuidas = 0;
  let receitaNaoAtribuida = 0;
  for (const l of base.leads) {
    if (l.dia! < de || l.dia! > ate || !daBu(l.bu as BuMarketing)) continue;
    const { ultimo, primeiro } = base.ctxLead(l);
    if (l.is_won) {
      vendasTotais++;
      if (ultimo) vendasAtribuidas++;
      else receitaNaoAtribuida += l.revenue;
    }
    if (ultimo && daBu(ultimo.bu)) {
      const c = crm.get(ultimo.chave) ?? novoCrm();
      c.leads++;
      if (l.criado_em! <= base.mat.corte) c.maduros++;
      if (l.is_mql) c.mql++;
      if (l.is_won) {
        c.vendas++;
        c.receita += l.revenue;
      }
      crm.set(ultimo.chave, c);
    }
    if (l.is_won && primeiro && daBu(primeiro.bu)) {
      const c = crm.get(primeiro.chave) ?? novoCrm();
      c.vendasPt++;
      crm.set(primeiro.chave, c);
    }
  }

  const ctxPorChave = new Map([...base.campanha.values()].map((c) => [c.chave, c]));
  const todas: LinhaCampanha[] = [...new Set([...meta.keys(), ...crm.keys()])]
    .map((chave) => {
      const ctx = ctxPorChave.get(chave)!;
      const m = meta.get(chave) ?? novoAcumulado();
      const c = crm.get(chave) ?? novoCrm();
      const freq = m.impr ? m.freqW / m.impr : null;
      const cplIni = razao(m.gastoIni, m.leadsIni);
      const cplFim = razao(m.gastoFim, m.leadsFim);
      const sat = saturacao({ leads: m.leadsMeta, freqMedia: freq, cplIni, cplFim }, base.limiares);
      return {
        chave,
        campaignId: ctx.campaignId,
        nome: ctx.nome,
        bu: ctx.bu,
        gasto: m.gasto,
        impressoes: m.impr,
        frequencia: freq,
        leadsMeta: m.leadsMeta,
        leadsCrm: c.leads,
        leadsMaduros: c.maduros,
        mql: c.mql,
        vendas: c.vendas,
        vendasPrimeiroToque: c.vendasPt,
        receita: c.receita,
        cplMeta: razao(m.gasto, m.leadsMeta),
        cplCrm: razao(m.gasto, c.leads),
        custoMql: razao(m.gasto, c.mql),
        cacTeto: razao(m.gasto, c.vendasPt),
        // Sem nenhum lead no CRM, a receita é desconhecida (ex.: venda pela Hotmart), não zero.
        roas: c.leads ? razao(c.receita, m.gasto) : null,
        saturando: sat.saturando,
        motivoSaturacao: sat.motivo,
        jovem: c.leads > 0 && c.maduros < c.leads * base.limiares.maturidade_min,
      };
    })
    .filter((l) => l.gasto > 0 || l.leadsCrm > 0)
    .sort((a, b) => b.gasto - a.gasto);

  const linhas = filtro.campanha ? todas.filter((l) => l.chave === filtro.campanha) : todas;
  const soma = (f: (l: LinhaCampanha) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const gasto = soma((l) => l.gasto);
  const receita = soma((l) => l.receita);
  const vendasPt = soma((l) => l.vendasPrimeiroToque);
  const cobertura = vendasTotais ? vendasAtribuidas / vendasTotais : null;

  return {
    de,
    ate,
    temDados: base.temDados,
    sincronizadoEm: base.sincronizadoEm,
    erroSync: base.erroSync,
    limiares: base.limiares,
    medianaDias: base.mat.mediana,
    opcoesCampanha: todas.map((l) => ({ valor: l.chave, rotulo: l.nome })),
    kpis: {
      gasto,
      leadsMeta: soma((l) => l.leadsMeta),
      leadsCrm: soma((l) => l.leadsCrm),
      mql: soma((l) => l.mql),
      vendas: soma((l) => l.vendas),
      receita,
      cplMeta: razao(gasto, soma((l) => l.leadsMeta)),
      cacTeto: razao(gasto, vendasPt),
      // Sem receita atribuída, o ROAS é desconhecido (falta rastreio), não zero.
      roas: receita ? razao(receita, gasto) : null,
    },
    cobertura: { vendasTotais, vendasAtribuidas, taxa: cobertura, receitaNaoAtribuida, baixa: cobertura !== null && cobertura < base.limiares.cobertura_baixa },
    linhas,
  };
}

/** Leads (CRM e Meta) e gasto de um anúncio por dia da janela (mesmo índice de `serie.dias`). */
export interface SerieAnuncio {
  crm: number[];
  meta: number[];
  gasto: number[];
}

export interface LinhaCriativo {
  adId: string;
  nome: string;
  /** Link assinado (1 h) da miniatura guardada no Storage (0048); null sem imagem. */
  imagemUrl: string | null;
  /** Status do anúncio na Meta (ACTIVE, PAUSED…) e avaliação dos "Parâmetros de URL" (0050); null antes da sincronização. */
  statusAnuncio: string | null;
  urlTags: string | null;
  rastreio: ReturnType<typeof avaliarTagsAnuncio> | null;
  conjunto: string | null;
  gasto: number;
  impressoes: number;
  frequencia: number | null;
  leadsMeta: number;
  leads: number;
  leadsMaduros: number;
  mql: number;
  vendas: number;
  receita: number;
  cac: number | null;
  roas: number | null;
  cplIni: number | null;
  cplFim: number | null;
  recuperados: number;
  jovem: boolean;
  saturando: boolean;
  motivoSaturacao: string;
  acao: Acao;
  motivo: string;
}

/**
 * Detalhe da campanha (ranking por criativo, janela do nível anúncio): métricas
 * por criativo com os leads do Kommo resolvidos por ad_id (forte) ou nome único
 * (recuperado), ação recomendada e recomendações de portfólio da campanha.
 */
export async function carregarCriativos(supabase: Supa, chaveCampanha: string, periodo: PeriodoMarketing) {
  const base = await carregarBase(supabase);
  const [accountId, campaignId] = chaveCampanha.split(":");
  const ctx = base.campanha.get(campaignId);
  if (!ctx || ctx.accountId !== accountId) return null;
  // "Campanha inteira": do primeiro ao último dia com gasto (até hoje, se ainda roda).
  const diasComGasto = base.campanhas.filter((r) => r.campaign_id === campaignId && Number(r.spend) > 0).map((r) => r.dia).sort();
  const intervalo = intervaloMarketing(periodo, base.backfillDesde);
  const ultimoGasto = diasComGasto.at(-1);
  const { de, ate } =
    periodo === "tudo" && diasComGasto.length
      ? { de: diasComGasto[0], ate: ultimoGasto! >= somarDias(intervalo.ate, -1) ? intervalo.ate : ultimoGasto! }
      : intervalo;
  const meio = somarDias(de, Math.floor((Date.parse(ate) - Date.parse(de)) / 86_400_000 / 2));

  // Nome → anúncio, só quando o nome corresponde a exatamente um anúncio (chave fraca).
  const idsPorNome = new Map<string, Set<string>>();
  for (const a of base.anuncios) {
    const n = normalizarNome(a.ad_name);
    if (n) idsPorNome.set(n, (idsPorNome.get(n) ?? new Set()).add(a.ad_id));
  }
  const unico = new Map([...idsPorNome].filter(([, ids]) => ids.size === 1).map(([n, ids]) => [n, [...ids][0]]));

  // Série diária por anúncio (gráfico de leads acumulados): índice do dia na janela.
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  const indiceDia = new Map(dias.map((d, i) => [d, i]));
  const serie: Record<string, SerieAnuncio> = {};
  const serieDe = (adId: string) => (serie[adId] ??= { crm: dias.map(() => 0), meta: dias.map(() => 0), gasto: dias.map(() => 0) });

  const meta = new Map<string, Acumulado & { nome: string; conjunto: string | null }>();
  for (const r of base.anuncios) {
    if (r.campaign_id !== campaignId || r.dia < de || r.dia > ate) continue;
    const i = indiceDia.get(r.dia)!;
    serieDe(r.ad_id).meta[i] += Number(r.leads);
    serieDe(r.ad_id).gasto[i] += Number(r.spend);
    const a = meta.get(r.ad_id) ?? { ...novoAcumulado(), nome: r.ad_name ?? r.ad_id, conjunto: r.adset_name };
    acumular(a, { spend: Number(r.spend), impressions: Number(r.impressions), frequency: Number(r.frequency), leads: Number(r.leads), dia: r.dia }, meio);
    meta.set(r.ad_id, a);
  }
  // Nível campanha (histórico completo, não só a janela do nível anúncio): KPIs e
  // a série "Campanha inteira" do gráfico; leads do Kommo atribuídos à campanha
  // pelo ID da campanha ou do anúncio (mesma regra da Visão A).
  const totaisCampanha = { gasto: 0, impressoes: 0, freqW: 0, leadsMeta: 0, leadsCrm: 0, mql: 0, vendas: 0, receita: 0 };
  const serieCampanha: SerieAnuncio = { crm: dias.map(() => 0), meta: dias.map(() => 0), gasto: dias.map(() => 0) };
  for (const r of base.campanhas) {
    if (r.campaign_id !== campaignId || r.dia < de || r.dia > ate) continue;
    const i = indiceDia.get(r.dia)!;
    serieCampanha.meta[i] += Number(r.leads);
    serieCampanha.gasto[i] += Number(r.spend);
    totaisCampanha.gasto += Number(r.spend);
    totaisCampanha.leadsMeta += Number(r.leads);
    totaisCampanha.impressoes += Number(r.impressions);
    totaisCampanha.freqW += Number(r.frequency) * Number(r.impressions);
  }
  for (const l of base.leads) {
    if (l.dia! < de || l.dia! > ate || base.ctxLead(l).ultimo?.campaignId !== campaignId) continue;
    serieCampanha.crm[indiceDia.get(l.dia!)!]++;
    totaisCampanha.leadsCrm++;
    if (l.is_mql) totaisCampanha.mql++;
    if (l.is_won) {
      totaisCampanha.vendas++;
      totaisCampanha.receita += l.revenue;
    }
  }

  const anunciosDaCampanha = new Set(base.anuncios.filter((a) => a.campaign_id === campaignId).map((a) => a.ad_id));

  type Crm = { leads: number; maduros: number; mql: number; vendas: number; receita: number; recuperados: number };
  const crm = new Map<string, Crm>();
  for (const l of base.leads) {
    if (l.dia! < de || l.dia! > ate) continue;
    let adId: string | null = null;
    let recuperado = false;
    if (l.ad_id) adId = l.ad_id;
    else {
      const r = unico.get(normalizarNome(l.ad_name_raw));
      if (r) {
        adId = r;
        recuperado = true;
      }
    }
    if (!adId || !anunciosDaCampanha.has(adId)) continue;
    const c = crm.get(adId) ?? { leads: 0, maduros: 0, mql: 0, vendas: 0, receita: 0, recuperados: 0 };
    c.leads++;
    if (l.criado_em! <= base.mat.corte) c.maduros++;
    if (l.is_mql) c.mql++;
    if (l.is_won) {
      c.vendas++;
      c.receita += l.revenue;
    }
    if (recuperado) c.recuperados++;
    crm.set(adId, c);
    serieDe(adId).crm[indiceDia.get(l.dia!)!]++;
  }

  const criativos: LinhaCriativo[] = [...new Set([...meta.keys(), ...crm.keys()])].map((adId) => {
    const m = meta.get(adId) ?? { ...novoAcumulado(), nome: base.anuncios.find((a) => a.ad_id === adId)?.ad_name ?? adId, conjunto: null };
    const c = crm.get(adId) ?? { leads: 0, maduros: 0, mql: 0, vendas: 0, receita: 0, recuperados: 0 };
    const freq = m.impr ? m.freqW / m.impr : null;
    const cplIni = razao(m.gastoIni, m.leadsIni);
    const cplFim = razao(m.gastoFim, m.leadsFim);
    const jovem = c.leads > 0 && c.maduros < c.leads * base.limiares.maturidade_min;
    // Saturação e recomendação sobre os leads do CRM (como no ranking dos scripts).
    const amostra = { leads: c.leads, freqMedia: freq, cplIni, cplFim };
    const sat = saturacao(amostra, base.limiares);
    const { acao, motivo } = avaliarCriativo(
      { ...amostra, gasto: m.gasto, leadsMaduros: c.maduros, mql: c.mql, vendas: c.vendas, receita: c.receita, jovem, recuperados: c.recuperados },
      base.limiares,
    );
    return {
      adId,
      nome: m.nome,
      imagemUrl: null as string | null,
      statusAnuncio: null as string | null,
      urlTags: null as string | null,
      rastreio: null as ReturnType<typeof avaliarTagsAnuncio> | null,
      conjunto: m.conjunto,
      gasto: m.gasto,
      impressoes: m.impr,
      frequencia: freq,
      leadsMeta: m.leadsMeta,
      leads: c.leads,
      leadsMaduros: c.maduros,
      mql: c.mql,
      vendas: c.vendas,
      receita: c.receita,
      cac: razao(m.gasto, c.vendas),
      roas: c.leads ? razao(c.receita, m.gasto) : null,
      cplIni,
      cplFim,
      recuperados: c.recuperados,
      jovem,
      saturando: sat.saturando,
      motivoSaturacao: sat.motivo,
      acao,
      motivo,
    };
  });
  criativos.sort((a, b) => ORDEM_ACAO[a.acao] - ORDEM_ACAO[b.acao] || b.vendas - a.vendas || b.gasto - a.gasto);

  // Miniaturas: links assinados do bucket privado, numa chamada só.
  const { data: criativosMeta } = await supabase
    .from("mkt_meta_criativos")
    .select("ad_id, imagem_path, urls_destino, url_tags, status_anuncio")
    .in("ad_id", criativos.map((c) => c.adId));
  // Rastreio de cada anúncio (0050): status na Meta e avaliação dos parâmetros de URL.
  for (const cm of criativosMeta ?? []) {
    const c = criativos.find((x) => x.adId === cm.ad_id);
    if (!c || cm.status_anuncio === null) continue;
    c.statusAnuncio = cm.status_anuncio;
    c.urlTags = cm.url_tags;
    c.rastreio = avaliarTagsAnuncio(cm.url_tags);
  }
  // Ativos primeiro (a ordem por ação recomendada vale dentro de cada grupo).
  criativos.sort((a, b) => Number(b.statusAnuncio === "ACTIVE") - Number(a.statusAnuncio === "ACTIVE"));
  const imagens = (criativosMeta ?? []).filter((c) => c.imagem_path);
  // Páginas de destino da campanha, da que recebeu mais gasto para a que recebeu menos.
  const gastoPorDestino = new Map<string, number>();
  for (const cm of criativosMeta ?? [])
    for (const u of cm.urls_destino ?? []) gastoPorDestino.set(u, (gastoPorDestino.get(u) ?? 0) + (criativos.find((c) => c.adId === cm.ad_id)?.gasto ?? 0));
  const destinos = [...gastoPorDestino].sort((a, b) => b[1] - a[1]).map(([u]) => u);
  if (imagens.length) {
    const { data: links } = await supabase.storage.from(BUCKET_CRIATIVOS).createSignedUrls(imagens.map((i) => i.imagem_path!), 3600);
    const porCaminho = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
    const porAnuncio = new Map(imagens.map((i) => [i.ad_id, porCaminho.get(i.imagem_path!) ?? null]));
    for (const c of criativos) c.imagemUrl = porAnuncio.get(c.adId) ?? null;
  }

  const recomendacoes = recomendacoesCampanha(
    criativos.map((c) => ({ id: c.adId, nome: c.nome, gasto: c.gasto, leads: c.leads, freqMedia: c.frequencia, cplIni: c.cplIni, cplFim: c.cplFim })),
    base.limiares,
  );
  const inicioJanela = base.anuncios.reduce((min, a) => (!min || a.dia < min ? a.dia : min), "");

  return {
    campanha: ctx,
    de,
    ate,
    destinos,
    inicioJanelaAnuncio: inicioJanela,
    medianaDias: base.mat.mediana,
    sincronizadoEm: base.sincronizadoEm,
    criativos,
    serie: { dias, anuncios: serie, campanha: serieCampanha },
    totaisCampanha: {
      gasto: totaisCampanha.gasto,
      impressoes: totaisCampanha.impressoes,
      frequencia: totaisCampanha.impressoes ? totaisCampanha.freqW / totaisCampanha.impressoes : null,
      leadsMeta: totaisCampanha.leadsMeta,
      leadsCrm: totaisCampanha.leadsCrm,
      mql: totaisCampanha.mql,
      vendas: totaisCampanha.vendas,
      receita: totaisCampanha.receita,
    },
    recomendacoes,
    totais: {
      gasto: totaisCampanha.gasto,
      ativos: criativos.filter((c) => c.gasto > 0).length,
    },
  };
}

// ─────────────────────── Visão B — Investimento × Retorno ───────────────────────

export type Granularidade = "mes" | "semana";

export interface PontoRetorno {
  chave: string; // aaaa-mm (mês) ou aaaa-mm-dd (segunda-feira da semana)
  rotulo: string;
  rotuloCompleto: string;
  investimento: number;
  receita: number;
  vendas: number;
  /** Safra imatura: o período tem leads mais novos que a mediana lead → venda. */
  imatura: boolean;
}

export interface LinhaRetorno {
  chave: string;
  nome: string;
  bu: BuMarketing;
  investimento: number;
  receita: number;
  vendas: number;
  vendasPrimeiroToque: number;
  roas: number | null;
  cacTeto: number | null;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const segunda = (iso: string) => somarDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

function bucket(dia: string, g: Granularidade) {
  if (g === "mes") {
    const [a, m] = dia.split("-");
    return { chave: `${a}-${m}`, rotulo: MESES_CURTOS[Number(m) - 1], rotuloCompleto: `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}` };
  }
  const s = segunda(dia);
  return { chave: s, rotulo: `${s.slice(8, 10)}/${s.slice(5, 7)}`, rotuloCompleto: `semana de ${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` };
}

/**
 * Visão B: investimento da Meta × receita atribuída pelo Kommo (coorte: data
 * de criação do lead), por mês ou semana, por BU e campanha. A receita
 * contábil (vendas do Bling: Academy por curso, Footlink por pedido de venda)
 * vem como referência, ao lado — nunca somada à atribuída (spec §6, R1).
 */
export async function carregarInvestimentoRetorno(supabase: Supa, filtro: FiltroMarketing, granularidade: Granularidade, contabil: { academy: { data: string; valor: number }[]; footlink: { data: string; valor: number }[] }) {
  const base = await carregarBase(supabase);
  const { de, ate } = intervaloMarketing(filtro.periodo, base.backfillDesde);
  const daBu = (bu: BuMarketing) => filtro.bu === "todas" || filtro.bu === bu;
  const daCampanha = (chave: string) => !filtro.campanha || filtro.campanha === chave;
  const corteDia = diaBrt(base.mat.corte)!;

  // Série vazia do período (todos os meses/semanas aparecem, mesmo sem gasto).
  const pontos = new Map<string, PontoRetorno>();
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    const b = bucket(d, granularidade);
    const p = pontos.get(b.chave) ?? { ...b, investimento: 0, receita: 0, vendas: 0, imatura: false };
    if (d > corteDia) p.imatura = true;
    pontos.set(b.chave, p);
  }

  const linhas = new Map<string, LinhaRetorno>();
  const linha = (ctx: { chave: string; nome: string; bu: BuMarketing }) =>
    linhas.get(ctx.chave) ?? { chave: ctx.chave, nome: ctx.nome, bu: ctx.bu, investimento: 0, receita: 0, vendas: 0, vendasPrimeiroToque: 0, roas: null, cacTeto: null };

  for (const r of base.campanhas) {
    if (r.dia < de || r.dia > ate) continue;
    const ctx = base.campanha.get(r.campaign_id);
    if (!ctx || !daBu(ctx.bu) || !daCampanha(ctx.chave)) continue;
    const gasto = Number(r.spend);
    pontos.get(bucket(r.dia, granularidade).chave)!.investimento += gasto;
    const l = linha(ctx);
    l.investimento += gasto;
    linhas.set(ctx.chave, l);
  }

  let vendasTotais = 0;
  let vendasAtribuidas = 0;
  let receitaNaoAtribuida = 0;
  for (const l of base.leads) {
    if (!l.is_won || l.dia! < de || l.dia! > ate || !daBu(l.bu as BuMarketing)) continue;
    const { ultimo, primeiro } = base.ctxLead(l);
    if (!filtro.campanha) {
      vendasTotais++;
      if (ultimo) vendasAtribuidas++;
      else receitaNaoAtribuida += l.revenue;
    }
    if (ultimo && daBu(ultimo.bu) && daCampanha(ultimo.chave)) {
      if (filtro.campanha) {
        vendasTotais++;
        vendasAtribuidas++;
      }
      const p = pontos.get(bucket(l.dia!, granularidade).chave)!;
      p.receita += l.revenue;
      p.vendas++;
      const li = linha(ultimo);
      li.receita += l.revenue;
      li.vendas++;
      linhas.set(ultimo.chave, li);
    }
    if (primeiro && daBu(primeiro.bu) && daCampanha(primeiro.chave)) {
      const li = linha(primeiro);
      li.vendasPrimeiroToque++;
      linhas.set(primeiro.chave, li);
    }
  }

  const tabela = [...linhas.values()]
    .map((l) => ({ ...l, roas: l.investimento ? l.receita / l.investimento : null, cacTeto: razao(l.investimento, l.vendasPrimeiroToque) }))
    .filter((l) => l.investimento > 0 || l.receita > 0)
    .sort((a, b) => b.investimento - a.investimento);
  const porBu = (["academy", "footlink"] as BuMarketing[])
    .filter(daBu)
    .map((bu) => {
      const ls = tabela.filter((l) => l.bu === bu);
      const investimento = ls.reduce((s, l) => s + l.investimento, 0);
      const receita = ls.reduce((s, l) => s + l.receita, 0);
      const vendasPt = ls.reduce((s, l) => s + l.vendasPrimeiroToque, 0);
      const contabilBu = filtro.campanha ? null : contabil[bu].filter((v) => v.data >= de && v.data <= ate).reduce((s, v) => s + v.valor, 0);
      // Sem receita atribuída, o ROAS da BU é desconhecido (falta rastreio), não zero.
      return { bu, investimento, receita, roas: investimento && receita ? receita / investimento : null, cacTeto: razao(investimento, vendasPt), contabil: contabilBu };
    });

  const investimento = tabela.reduce((s, l) => s + l.investimento, 0);
  const receita = tabela.reduce((s, l) => s + l.receita, 0);
  const vendasPt = tabela.reduce((s, l) => s + l.vendasPrimeiroToque, 0);
  const taxa = vendasTotais ? vendasAtribuidas / vendasTotais : null;
  const contabilTotal = porBu.every((b) => b.contabil !== null) ? porBu.reduce((s, b) => s + (b.contabil ?? 0), 0) : null;

  return {
    de,
    ate,
    temDados: base.temDados,
    sincronizadoEm: base.sincronizadoEm,
    erroSync: base.erroSync,
    medianaDias: base.mat.mediana,
    corteMaturidade: corteDia,
    opcoesCampanha: [...base.campanha.values()]
      .filter((c) => daBu(c.bu) && tabela.some((l) => l.chave === c.chave))
      .map((c) => ({ valor: c.chave, rotulo: c.nome })),
    kpis: { investimento, receita, roas: investimento && receita ? receita / investimento : null, cacTeto: razao(investimento, vendasPt), contabil: contabilTotal },
    cobertura: { vendasTotais, vendasAtribuidas, taxa, receitaNaoAtribuida, baixa: taxa !== null && taxa < base.limiares.cobertura_baixa },
    serie: [...pontos.values()],
    porBu,
    tabela,
  };
}

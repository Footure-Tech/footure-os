// Visão Funil do detalhe da campanha (F2, 0054): a campanha de ponta a ponta,
// da impressão na Meta à venda no Kommo, comparada com a média da BU.
//
// • Safra: leads CRIADOS no período (as taxas não misturam leads de safras
//   diferentes). Atribuição à campanha igual à do resto do módulo (ctxLead.ultimo).
// • Estágio atingido: o maior estágio padrão por onde o lead passou (etapa
//   atual + histórico de mudanças de etapa). Lead perdido depois de qualificado
//   conta como qualificado; etapa que o funil não tem conta como atingida
//   quando o lead passa adiante (quem chegou à oferta passou pela conexão).
// • Média da BU: todos os leads e todo o gasto das campanhas da mesma BU no período.
// • Diagnóstico: cada passagem do funil aponta uma causa provável (mensagem,
//   página, conexão, qualificação, fechamento); a pior em relação à média da
//   BU, com amostra suficiente, é o gargalo. Rastreio é medição, não etapa:
//   aparece como alerta (distorce as taxas do Kommo) e não concorre a gargalo.
// • Conexão (F3, 0055): mensagens de WhatsApp/Instagram no Kommo. A primeira
//   mensagem enviada costuma ser automática (~6 min); a velocidade do time é
//   medida da primeira resposta do lead até a mensagem seguinte da Footure.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuMarketing, Database, EstagioFunil, ResumoConversaRow } from "@/lib/supabase/database.types";
import { anunciosPorNomeUnico, carregarBase, periodoDaCampanha, type PeriodoMarketing } from "./consultas";
import { normalizarNome, razao } from "./motor";
import { urlLeadKommo } from "@/lib/integracoes/kommo";

type Supa = SupabaseClient<Database>;
type Base = Awaited<ReturnType<typeof carregarBase>>;
type LeadBase = Base["leads"][number];

/** Degraus do funil no Kommo (ganho = 6; perdido não é degrau). */
const DEGRAU: Partial<Record<EstagioFunil, number>> = { entrada: 0, tentativa: 1, conectado: 2, qualificado: 3, oferta: 4, negociacao: 5, ganho: 6 };

/** Amostra mínima (denominador) para uma taxa entrar no diagnóstico. */
const MIN_LEADS = 20;
const MIN_IMPRESSOES = 2000;
/** Abaixo de 85% da média da BU = abaixo; acima de 115% = acima. */
const FAIXA_MEDIA = 0.15;
/** Vídeo só entra como evidência quando a campanha roda vídeo (3 s vistos ≥ 1% das impressões). */
const MIN_PARTE_VIDEO = 0.01;

export type Hipotese = "mensagem" | "pagina" | "rastreio" | "conexao" | "qualificacao" | "fechamento";

/** Lead em andamento sem mensagem nem mudança de etapa há este tanto de dias = parado. */
const DIAS_PARADO = 3;

/** Faixa do tempo do time para responder o lead depois da primeira resposta dele. */
export type FaixaResposta = "ate1h" | "ate4h" | "ate24h" | "mais24h" | "semRetorno";
export const ROTULO_FAIXA_RESPOSTA: Record<FaixaResposta, string> = {
  ate1h: "Até 1 hora",
  ate4h: "De 1 a 4 horas",
  ate24h: "De 4 a 24 horas",
  mais24h: "Mais de 24 horas",
  semRetorno: "Lead respondeu e ficou sem retorno",
};
const faixaResposta = (min: number | null): FaixaResposta => (min === null ? "semRetorno" : min <= 60 ? "ate1h" : min <= 240 ? "ate4h" : min <= 1440 ? "ate24h" : "mais24h");

/** Onde o lead perdido parou (estágio máximo antes da perda). */
export type FaixaPerda = "antes" | "conectado" | "qualificado";

interface Contagem {
  leads: number;
  conectado: number;
  qualificado: number;
  oferta: number;
  negociacao: number;
  vendas: number;
  receita: number;
  perdidos: number;
  abertos: number;
  /** Perdidos por motivo (null = sem motivo) e onde pararam. */
  motivos: Map<number | null, Record<FaixaPerda, number>>;
}

const novaContagem = (): Contagem => ({ leads: 0, conectado: 0, qualificado: 0, oferta: 0, negociacao: 0, vendas: 0, receita: 0, perdidos: 0, abertos: 0, motivos: new Map() });

interface Topo {
  gasto: number;
  impressoes: number;
  cliques: number;
  paginas: number;
  checkouts: number;
  videos: number;
  leadsMeta: number;
}
const novoTopo = (): Topo => ({ gasto: 0, impressoes: 0, cliques: 0, paginas: 0, checkouts: 0, videos: 0, leadsMeta: 0 });

function contar(c: Contagem, l: LeadBase, degrau: number) {
  c.leads++;
  if (degrau >= 2) c.conectado++;
  if (degrau >= 3) c.qualificado++;
  if (degrau >= 4) c.oferta++;
  if (degrau >= 5) c.negociacao++;
  if (l.is_won) {
    c.vendas++;
    c.receita += l.revenue;
  } else if (l.is_lost) {
    c.perdidos++;
    const faixa: FaixaPerda = degrau >= 3 ? "qualificado" : degrau === 2 ? "conectado" : "antes";
    const m = c.motivos.get(l.loss_reason_id) ?? { antes: 0, conectado: 0, qualificado: 0 };
    m[faixa]++;
    c.motivos.set(l.loss_reason_id, m);
  } else c.abertos++;
}

const totalMotivo = (m: Record<FaixaPerda, number> | undefined) => (m ? m.antes + m.conectado + m.qualificado : 0);

export interface PassoFunil {
  id: "impressoes" | "cliques" | "paginas" | "leadsMeta" | "leadsCrm" | "conectado" | "qualificado" | "oferta" | "negociacao" | "vendas";
  rotulo: string;
  valor: number;
  /** Conversão a partir do passo anterior (null no primeiro ou sem base). */
  taxa: number | null;
  taxaBu: number | null;
  /** Da Meta ou do Kommo (o gráfico separa as duas partes). */
  fonte: "meta" | "kommo";
}

export interface CartaoDiagnostico {
  hipotese: Hipotese;
  titulo: string;
  pergunta: string;
  situacao: "abaixo" | "media" | "acima" | "sem_amostra";
  indice: number | null;
  evidencias: string[];
  gargalo: boolean;
}

export interface LinhaQualidade {
  chave: string;
  nome: string;
  gasto: number;
  leads: number;
  conectado: number;
  qualificado: number;
  vendas: number;
  perdidos: number;
  foraDoPerfil: number;
  faltaConexao: number;
}

/** Percentual com uma casa abaixo de 10% (taxa de clique) e inteiro acima. */
const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const minutos = (de: string | null, ate: string | null) => (de && ate ? (Date.parse(ate) - Date.parse(de)) / 60_000 : null);
/** Duração legível: minutos, horas ou dias. */
export const duracao = (min: number | null) =>
  min === null ? "—" : min < 90 ? `${Math.round(min)} min` : min < 2880 ? `${(min / 60).toFixed(1).replace(".", ",")} h` : `${(min / 1440).toFixed(1).replace(".", ",")} dias`;

const pct = (v: number | null) => (v === null ? "—" : v < 0.1 ? `${(v * 100).toFixed(1).replace(".", ",")}%` : `${Math.round(v * 100)}%`);

export async function carregarFunil(supabase: Supa, chaveCampanha: string, periodo: PeriodoMarketing) {
  const base = await carregarBase(supabase);
  const [accountId, campaignId] = chaveCampanha.split(":");
  const ctx = base.campanha.get(campaignId);
  if (!ctx || ctx.accountId !== accountId) return null;
  const { de, ate } = periodoDaCampanha(base, campaignId, periodo);

  const [{ data: etapas }, { data: motivos }, { data: funis }, { data: usuarios }, resumos] = await Promise.all([
    supabase.from("mkt_kommo_etapas").select("pipeline_id, status_id, estagio, nome"),
    supabase.from("mkt_kommo_motivos_perda").select("id, nome"),
    supabase.from("mkt_kommo_funis").select("pipeline_id, nome"),
    supabase.from("mkt_kommo_usuarios").select("id, nome"),
    lerResumosConversa(supabase, de, ate),
  ]);
  const nomeEtapa = new Map((etapas ?? []).map((e) => [`${e.pipeline_id}:${e.status_id}`, e.nome.trim()]));
  const nomeUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));
  const estagioDe = new Map((etapas ?? []).map((e) => [`${e.pipeline_id}:${e.status_id}`, e.estagio]));
  const degrauDe = (pipeline: number | null, status: number | null) => {
    const e = estagioDe.get(`${pipeline}:${status}`);
    return e ? (DEGRAU[e] ?? -1) : -1;
  };
  const nomeMotivo = new Map((motivos ?? []).map((m) => [m.id, m.nome]));
  const idMotivo = (re: RegExp) => (motivos ?? []).find((m) => re.test(m.nome))?.id ?? -1;
  const FORA_DO_PERFIL = idMotivo(/fora do perfil/i);
  const FALTA_CONEXAO = idMotivo(/falta de conex/i);
  const FINANCEIRO = idMotivo(/financeir/i);
  const TIMING = idMotivo(/timing/i);

  // Leads da safra: da campanha e da BU inteira (média de comparação).
  const daSafra = base.leads.filter((l) => l.dia! >= de && l.dia! <= ate);
  const campanhaDoLead = new Map(daSafra.map((l) => [l.lead_id, base.ctxLead(l).ultimo]));
  const daBu = daSafra.filter((l) => campanhaDoLead.get(l.lead_id)?.bu === ctx.bu);
  const daCampanha = daBu.filter((l) => campanhaDoLead.get(l.lead_id)?.campaignId === campaignId);

  // Estágio máximo pelo histórico de etapas (movimentos depois do início da safra).
  const maximo = new Map<number, number>();
  for (const l of daBu) maximo.set(l.lead_id, l.is_won ? DEGRAU.ganho! : degrauDe(l.pipeline_id, l.status_id));
  const movimentos = () =>
    supabase
      .from("mkt_kommo_movimentos")
      .select("lead_id, criado_em, pipeline_de, status_de, pipeline_para, status_para", { count: "exact" })
      .gte("criado_em", `${de}T00:00:00-03:00`)
      .order("evento_id");
  // Primeira página com a contagem; as demais em paralelo.
  const primeira = await movimentos().range(0, 999);
  if (primeira.error) throw new Error(primeira.error.message);
  const paginas = [primeira, ...(await Promise.all(Array.from({ length: Math.ceil((primeira.count ?? 0) / 1000) - 1 }, (_, i) => movimentos().range((i + 1) * 1000, (i + 1) * 1000 + 999))))];
  const ultimoMovimento = new Map<number, string>();
  for (const { data, error } of paginas) {
    if (error) throw new Error(error.message);
    for (const m of data ?? []) {
      const atual = maximo.get(m.lead_id);
      if (atual === undefined) continue;
      if (m.criado_em > (ultimoMovimento.get(m.lead_id) ?? "")) ultimoMovimento.set(m.lead_id, m.criado_em);
      maximo.set(m.lead_id, Math.max(atual, degrauDe(m.pipeline_de, m.status_de), degrauDe(m.pipeline_para, m.status_para)));
    }
  }

  const campanha = novaContagem();
  const bu = novaContagem();
  for (const l of daBu) {
    const degrau = maximo.get(l.lead_id) ?? -1;
    contar(bu, l, degrau);
    if (campanhaDoLead.get(l.lead_id)?.campaignId === campaignId) contar(campanha, l, degrau);
  }

  // Topo do funil (Meta, nível campanha): a campanha e todas as campanhas da BU.
  const topo = novoTopo();
  const topoBu = novoTopo();
  for (const r of base.campanhas) {
    if (r.dia < de || r.dia > ate || base.campanha.get(r.campaign_id)?.bu !== ctx.bu) continue;
    for (const t of r.campaign_id === campaignId ? [topo, topoBu] : [topoBu]) {
      t.gasto += Number(r.spend);
      t.impressoes += Number(r.impressions);
      t.cliques += Number(r.link_clicks);
      t.paginas += Number(r.landing_page_views);
      t.checkouts += Number(r.checkouts);
      t.videos += Number(r.video_views);
      t.leadsMeta += Number(r.leads);
    }
  }

  // ── Conexão e velocidade (mensagens do Kommo) ──
  const conexaoDe = (leads: LeadBase[]) => {
    const r = {
      leads: leads.length,
      comConversa: 0,
      semMensagem: 0,
      responderam: 0,
      primeiraMensagem: [] as number[],
      tempoTime: [] as number[],
      tentativasSemResposta: [] as number[],
      soUmaTentativa: 0,
      faixas: Object.fromEntries((Object.keys(ROTULO_FAIXA_RESPOSTA) as FaixaResposta[]).map((f) => [f, { leads: 0, qualificados: 0, vendas: 0 }])) as Record<
        FaixaResposta,
        { leads: number; qualificados: number; vendas: number }
      >,
    };
    for (const l of leads) {
      const c = resumos.get(l.lead_id);
      if (!c) {
        r.semMensagem++;
        continue;
      }
      r.comConversa++;
      if (!c.saidas) r.semMensagem++;
      const primeira = minutos(l.criado_em, c.primeira_saida_em);
      if (primeira !== null && primeira >= 0) r.primeiraMensagem.push(primeira);
      if (c.primeira_entrada_em) {
        r.responderam++;
        const t = minutos(c.primeira_entrada_em, c.resposta_time_em);
        if (t !== null) r.tempoTime.push(t);
        const f = r.faixas[faixaResposta(t)];
        f.leads++;
        if ((maximo.get(l.lead_id) ?? -1) >= 3) f.qualificados++;
        if (l.is_won) f.vendas++;
      } else if (c.saidas) {
        r.tentativasSemResposta.push(c.saidas);
        if (c.saidas <= 1) r.soUmaTentativa++;
      }
    }
    const ate1h = r.tempoTime.filter((t) => t <= 60).length;
    return {
      leads: r.leads,
      comConversa: r.comConversa,
      semMensagem: r.semMensagem,
      taxaResposta: razao(r.responderam, r.leads),
      responderam: r.responderam,
      primeiraMensagemMin: mediana(r.primeiraMensagem),
      tempoTimeMin: mediana(r.tempoTime),
      // Base: quem respondeu (sem retorno conta como fora de 1 h).
      respondidosAte1h: razao(ate1h, r.responderam),
      semRetorno: r.faixas.semRetorno.leads,
      tentativasMediana: mediana(r.tentativasSemResposta),
      naoResponderam: r.tentativasSemResposta.length,
      soUmaTentativa: r.soUmaTentativa,
      faixas: (Object.keys(r.faixas) as FaixaResposta[]).map((f) => ({ faixa: f, rotulo: ROTULO_FAIXA_RESPOSTA[f], ...r.faixas[f] })),
    };
  };
  const conexaoCampanha = conexaoDe(daCampanha);
  const conexaoBu = conexaoDe(daBu);

  // Parados: em andamento, sem mensagem nem mudança de etapa há DIAS_PARADO dias (os mais avançados primeiro).
  const limiteParado = Date.now() - DIAS_PARADO * 86_400_000;
  const parados = daCampanha
    .filter((l) => !l.is_won && !l.is_lost)
    .map((l) => {
      const ultima = [l.criado_em!, resumos.get(l.lead_id)?.ultima_mensagem_em ?? "", ultimoMovimento.get(l.lead_id) ?? ""].reduce((a, b) => (b > a ? b : a));
      return { l, ultima, degrau: maximo.get(l.lead_id) ?? -1 };
    })
    .filter((p) => Date.parse(p.ultima) < limiteParado)
    .sort((a, b) => b.degrau - a.degrau || a.ultima.localeCompare(b.ultima))
    .map(({ l, ultima }) => ({
      leadId: l.lead_id,
      url: urlLeadKommo(l.lead_id),
      etapa: nomeEtapa.get(`${l.pipeline_id}:${l.status_id}`) ?? "—",
      responsavel: l.responsavel_id ? (nomeUsuario.get(l.responsavel_id) ?? null) : null,
      diasParado: Math.floor((Date.now() - Date.parse(ultima)) / 86_400_000),
      respondeu: !!resumos.get(l.lead_id)?.primeira_entrada_em,
    }));

  // ── Funil passo a passo ──
  const passos: Array<PassoFunil & { valorBu: number }> = [];
  const passo = (id: PassoFunil["id"], rotulo: string, fonte: PassoFunil["fonte"], valor: number, valorBu: number) => {
    const ant = passos.at(-1);
    passos.push({ id, rotulo, fonte, valor, valorBu, taxa: ant ? razao(valor, ant.valor) : null, taxaBu: ant ? razao(valorBu, ant.valorBu) : null });
  };
  passo("impressoes", "Impressões", "meta", topo.impressoes, topoBu.impressoes);
  passo("cliques", "Cliques no link", "meta", topo.cliques, topoBu.cliques);
  passo("paginas", "Páginas vistas", "meta", topo.paginas, topoBu.paginas);
  passo("leadsMeta", "Leads (Meta)", "meta", topo.leadsMeta, topoBu.leadsMeta);
  passo("leadsCrm", "Leads no Kommo", "kommo", campanha.leads, bu.leads);
  passo("conectado", "Conectados", "kommo", campanha.conectado, bu.conectado);
  passo("qualificado", "Qualificados", "kommo", campanha.qualificado, bu.qualificado);
  passo("oferta", "Reunião / Oferta", "kommo", campanha.oferta, bu.oferta);
  passo("negociacao", "Negociação", "kommo", campanha.negociacao, bu.negociacao);
  passo("vendas", "Vendas", "kommo", campanha.vendas, bu.vendas);
  const taxa = (id: PassoFunil["id"]) => passos.find((p) => p.id === id)!;

  // Participação de um motivo nas perdas (campanha × BU).
  const partePerdas = (c: Contagem, ...ids: number[]) => razao(ids.reduce((s, id) => s + totalMotivo(c.motivos.get(id)), 0), c.perdidos);

  // ── Diagnóstico ──
  const situacao = (indice: number | null, amostra: boolean): CartaoDiagnostico["situacao"] =>
    !amostra || indice === null ? "sem_amostra" : indice < 1 - FAIXA_MEDIA ? "abaixo" : indice > 1 + FAIXA_MEDIA ? "acima" : "media";
  const indice = (a: number | null, b: number | null) => (a === null || !b ? null : a / b);
  const indiceComposto = (...pares: Array<[number | null, number | null]>) => {
    const v = pares.map(([a, b]) => indice(a, b)).filter((x): x is number => x !== null);
    return v.length ? Math.min(...v) : null;
  };
  const vsBu = (rotulo: string, a: number | null, b: number | null) => `${rotulo}: ${pct(a)} (média da BU ${pct(b)})`;

  const ctr = taxa("cliques");
  const lpv = taxa("paginas");
  const convPagina = taxa("leadsMeta");
  const rastreio = taxa("leadsCrm");
  const conexao = taxa("conectado");
  const qualif = taxa("qualificado");
  const fechamento = { taxa: razao(campanha.vendas, campanha.qualificado), taxaBu: razao(bu.vendas, bu.qualificado) };
  const gancho = { taxa: razao(topo.videos, topo.impressoes), taxaBu: razao(topoBu.videos, topoBu.impressoes) };
  const perdasConexao = [partePerdas(campanha, FALTA_CONEXAO), partePerdas(bu, FALTA_CONEXAO)] as const;
  const perdasPerfil = [partePerdas(campanha, FORA_DO_PERFIL), partePerdas(bu, FORA_DO_PERFIL)] as const;
  const perdasPreco = [partePerdas(campanha, FINANCEIRO, TIMING), partePerdas(bu, FINANCEIRO, TIMING)] as const;
  const amostraCrm = campanha.leads >= MIN_LEADS;

  const cartoes: CartaoDiagnostico[] = [
    {
      hipotese: "mensagem",
      titulo: "Mensagem e criativo",
      pergunta: "O anúncio chama atenção e gera clique?",
      indice: indice(ctr.taxa, ctr.taxaBu),
      situacao: situacao(indice(ctr.taxa, ctr.taxaBu), topo.impressoes >= MIN_IMPRESSOES),
      evidencias: [
        vsBu("Taxa de clique no link", ctr.taxa, ctr.taxaBu),
        ...((gancho.taxa ?? 0) >= MIN_PARTE_VIDEO ? [`Vídeo assistido por 3 s em ${pct(gancho.taxa)} das impressões`] : []),
      ],
      gargalo: false,
    },
    {
      hipotese: "pagina",
      titulo: "Página e oferta",
      pergunta: "A página carrega e convence a deixar o contato?",
      ...(() => {
        const i = indiceComposto([lpv.taxa, lpv.taxaBu], [convPagina.taxa, convPagina.taxaBu]);
        return { indice: i, situacao: situacao(i, topo.cliques >= 100) };
      })(),
      evidencias: [
        vsBu("Cliques que viram página vista", lpv.taxa, lpv.taxaBu),
        vsBu("Páginas vistas que viram lead", convPagina.taxa, convPagina.taxaBu),
        ...(topo.checkouts ? [`${Math.round(topo.checkouts).toLocaleString("pt-BR")} checkouts iniciados`] : []),
      ],
      gargalo: false,
    },
    {
      hipotese: "rastreio",
      titulo: "Rastreio",
      pergunta: "Os leads da Meta chegam ao Kommo com a campanha?",
      // Absoluto, não relativo à BU: abaixo de 70% dos leads da Meta no Kommo há perda de rastreio.
      indice: rastreio.taxa === null ? null : rastreio.taxa / 0.7,
      situacao: topo.leadsMeta < MIN_LEADS || rastreio.taxa === null ? "sem_amostra" : rastreio.taxa < 0.7 ? "abaixo" : "media",
      evidencias: [`${campanha.leads} leads no Kommo para ${Math.round(topo.leadsMeta)} leads na Meta (${pct(rastreio.taxa)})`],
      gargalo: false,
    },
    {
      hipotese: "conexao",
      titulo: "Conexão",
      pergunta: "O time consegue falar com o lead?",
      // A perda por "Falta de Conexão" acima da média também puxa para baixo.
      ...(() => {
        const i = indiceComposto([conexao.taxa, conexao.taxaBu], [perdasConexao[1], perdasConexao[0]]);
        return { indice: i, situacao: situacao(i, amostraCrm) };
      })(),
      evidencias: [
        vsBu("Leads que conectaram", conexao.taxa, conexao.taxaBu),
        vsBu("“Falta de Conexão” nas perdas", ...perdasConexao),
        ...(conexaoCampanha.comConversa ? [vsBu("Responderam no WhatsApp", conexaoCampanha.taxaResposta, conexaoBu.taxaResposta)] : []),
        ...(conexaoCampanha.responderam ? [vsBu("Time respondeu o lead em até 1 h", conexaoCampanha.respondidosAte1h, conexaoBu.respondidosAte1h)] : []),
      ],
      gargalo: false,
    },
    {
      hipotese: "qualificacao",
      titulo: "Qualificação",
      pergunta: "O lead que a campanha traz tem perfil?",
      ...(() => {
        const i = indiceComposto([qualif.taxa, qualif.taxaBu], [perdasPerfil[1], perdasPerfil[0]]);
        return { indice: i, situacao: situacao(i, campanha.conectado >= MIN_LEADS) };
      })(),
      evidencias: [vsBu("Conectados que se qualificaram", qualif.taxa, qualif.taxaBu), vsBu("“Fora do Perfil” nas perdas", ...perdasPerfil)],
      gargalo: false,
    },
    {
      hipotese: "fechamento",
      titulo: "Fechamento",
      pergunta: "O lead qualificado compra?",
      indice: indice(fechamento.taxa, fechamento.taxaBu),
      situacao: situacao(indice(fechamento.taxa, fechamento.taxaBu), campanha.qualificado >= MIN_LEADS),
      evidencias: [vsBu("Qualificados que compraram", fechamento.taxa, fechamento.taxaBu), vsBu("Preço e momento (Financeiros + Timing) nas perdas", ...perdasPreco)],
      gargalo: false,
    },
  ];
  const piores = cartoes.filter((c) => c.situacao === "abaixo" && c.hipotese !== "rastreio").sort((a, b) => a.indice! - b.indice!);
  if (piores[0]) piores[0].gargalo = true;

  // ── Perdas por motivo (campanha × BU) ──
  const perdas = [...new Set([...campanha.motivos.keys()])]
    .map((id) => {
      const m = campanha.motivos.get(id)!;
      return {
        id,
        nome: id === null ? "Sem motivo registrado" : (nomeMotivo.get(id) ?? `Motivo ${id}`),
        total: totalMotivo(m),
        parte: razao(totalMotivo(m), campanha.perdidos),
        parteBu: razao(totalMotivo(bu.motivos.get(id)), bu.perdidos),
        onde: m,
      };
    })
    .sort((a, b) => Number(a.id === null) - Number(b.id === null) || b.total - a.total);

  // ── Qualidade por criativo e por público (conjunto de anúncios) ──
  const unico = anunciosPorNomeUnico(base);
  const anuncioDaCampanha = new Map<string, { nome: string; conjunto: string }>();
  const gastoAnuncio = new Map<string, number>();
  for (const a of base.anuncios) {
    if (a.campaign_id !== campaignId) continue;
    anuncioDaCampanha.set(a.ad_id, { nome: a.ad_name ?? a.ad_id, conjunto: a.adset_name ?? "Sem conjunto" });
    if (a.dia >= de && a.dia <= ate) gastoAnuncio.set(a.ad_id, (gastoAnuncio.get(a.ad_id) ?? 0) + Number(a.spend));
  }
  const porCriativo = new Map<string, LinhaQualidade>();
  const porPublico = new Map<string, LinhaQualidade>();
  const linha = (mapa: Map<string, LinhaQualidade>, chave: string, nome: string) => {
    let q = mapa.get(chave);
    if (!q) mapa.set(chave, (q = { chave, nome, gasto: 0, leads: 0, conectado: 0, qualificado: 0, vendas: 0, perdidos: 0, foraDoPerfil: 0, faltaConexao: 0 }));
    return q;
  };
  for (const [adId, gasto] of gastoAnuncio) {
    const a = anuncioDaCampanha.get(adId)!;
    linha(porCriativo, adId, a.nome).gasto += gasto;
    linha(porPublico, a.conjunto, a.conjunto).gasto += gasto;
  }
  for (const l of daCampanha) {
    const adId = l.ad_id ?? unico.get(normalizarNome(l.ad_name_raw)) ?? null;
    const a = adId ? anuncioDaCampanha.get(adId) : undefined;
    const degrau = maximo.get(l.lead_id) ?? -1;
    for (const q of [
      a ? linha(porCriativo, adId!, a.nome) : linha(porCriativo, "-", "Sem anúncio identificado"),
      a ? linha(porPublico, a.conjunto, a.conjunto) : linha(porPublico, "-", "Sem anúncio identificado"),
    ]) {
      q.leads++;
      if (degrau >= 2) q.conectado++;
      if (degrau >= 3) q.qualificado++;
      if (l.is_won) q.vendas++;
      if (l.is_lost) {
        q.perdidos++;
        if (l.loss_reason_id === FORA_DO_PERFIL) q.foraDoPerfil++;
        if (l.loss_reason_id === FALTA_CONEXAO) q.faltaConexao++;
      }
    }
  }
  const ordenar = (m: Map<string, LinhaQualidade>) => [...m.values()].filter((q) => q.leads > 0 || q.gasto > 0).sort((a, b) => Number(a.chave === "-") - Number(b.chave === "-") || b.leads - a.leads || b.gasto - a.gasto);

  // ── Origem dos leads ──
  const fonte = new Map<string, number>();
  const toque = { mesmaCampanha: 0, primeiroEmOutra: 0, soPrimeiro: 0, semPrimeiro: 0 };
  const nomeFunil = new Map((funis ?? []).map((f) => [f.pipeline_id, f.nome]));
  const funil = new Map<string, number>();
  const ROTULO_FONTE: Record<string, string> = { meta: "Meta", fb: "Facebook", facebook: "Facebook", ig: "Instagram", instagram: "Instagram", th: "Threads", an: "Audience Network" };
  for (const l of daCampanha) {
    const f = l.utm_source ? (ROTULO_FONTE[l.utm_source] ?? l.utm_source) : "Não informada";
    fonte.set(f, (fonte.get(f) ?? 0) + 1);
    const n = nomeFunil.get(l.pipeline_id ?? -1) ?? "Funil desconhecido";
    funil.set(n, (funil.get(n) ?? 0) + 1);
    const ultimoProprio = l.campaign_id === campaignId || (!!l.ad_id && anuncioDaCampanha.has(l.ad_id));
    if (!ultimoProprio) toque.soPrimeiro++;
    else if (!l.ftp_campaign_id) toque.semPrimeiro++;
    else if (l.ftp_campaign_id === campaignId) toque.mesmaCampanha++;
    else toque.primeiroEmOutra++;
  }
  const lista = (m: Map<string, number>) => [...m].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

  return {
    de,
    ate,
    bu: ctx.bu as BuMarketing,
    passos: passos.map(({ id, rotulo, fonte, valor, taxa, taxaBu }) => ({ id, rotulo, fonte, valor, taxa, taxaBu })),
    topo,
    contagem: { leads: campanha.leads, vendas: campanha.vendas, receita: campanha.receita, perdidos: campanha.perdidos, abertos: campanha.abertos },
    custo: {
      porLead: razao(topo.gasto, campanha.leads),
      porQualificado: razao(topo.gasto, campanha.qualificado),
      porQualificadoBu: razao(topoBu.gasto, bu.qualificado),
      porVenda: razao(topo.gasto, campanha.vendas),
    },
    /** Mais da metade dos leads ainda em andamento: vendas e perdas ainda vão mudar. */
    safraImatura: campanha.leads > 0 && campanha.abertos / campanha.leads > 0.5,
    cartoes,
    perdas,
    qualidade: { criativos: ordenar(porCriativo), publicos: ordenar(porPublico) },
    origem: { fonte: lista(fonte), funil: lista(funil), toque },
    conexao: { campanha: conexaoCampanha, bu: conexaoBu, parados, diasParado: DIAS_PARADO },
    /** Leads da safra da campanha, compactos (contexto das notas nas Estratégias por IA; a tela não usa). */
    leadsDaSafra: daCampanha.map((l) => {
      const degrau = maximo.get(l.lead_id) ?? -1;
      return {
        leadId: l.lead_id,
        estagio: (Object.entries(DEGRAU).find(([, d]) => d === degrau)?.[0] ?? null) as EstagioFunil | null,
        desfecho: l.is_won ? ("ganho" as const) : l.is_lost ? ("perdido" as const) : ("em andamento" as const),
        motivo: l.is_lost ? (l.loss_reason_id === null ? "sem motivo" : (nomeMotivo.get(l.loss_reason_id) ?? null)) : null,
      };
    }),
  };
}

/** Resumo das conversas por lead criado no período (mkt_resumo_conversas, paginado de 1.000 em 1.000). */
async function lerResumosConversa(supabase: Supa, de: string, ate: string) {
  const mapa = new Map<number, ResumoConversaRow>();
  for (let p = 0; ; p++) {
    const { data, error } = await supabase.rpc("mkt_resumo_conversas", { de, ate }).range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`Resumo das conversas: ${error.message}`);
    for (const r of data ?? []) mapa.set(r.lead_id, r);
    if ((data?.length ?? 0) < 1000) break;
  }
  return mapa;
}

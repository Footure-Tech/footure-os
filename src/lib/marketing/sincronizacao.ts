// Sincronização do módulo de Marketing (fase 1a, docs/modulo-marketing-spec.md
// §4.4): Meta (gasto/leads por dia, nível campanha e anúncio) e Kommo (funis,
// etapas e leads) para as tabelas mkt_*. Roda pelo cron diário (07:00 BRT) e
// pelo botão da Diretoria.
//
// • Carga do histórico (backfill desde mkt_configuracao.backfill_desde):
//   fatiada por mês (Meta) ou por página (Kommo), com cursor gravado em
//   mkt_sync_execucoes — para antes do prazo da função e a próxima execução
//   continua de onde parou (o plano Hobby da Vercel tem tempo de função curto).
// • Incremental: Meta reescreve os últimos 7 dias (a Meta revisa conversões na
//   janela de 7 dias de clique); Kommo pega leads ATUALIZADOS desde a última
//   execução boa − 1 dia (lead antigo que virou venda também entra).
// • A falha de uma conta/fonte não impede as outras; cada uma tem sua linha de
//   auditoria (status ok · parcial · erro).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuFunil, Database, KommoCampos, SyncExecucaoRow } from "@/lib/supabase/database.types";
import { buscarInsightsMeta, buscarImagensCriativosMeta, type LinhaMeta, type NivelMeta } from "@/lib/integracoes/meta";
import { buscarCamposLeadKommo, buscarFunisKommo, buscarPaginaLeadsKommo, normalizarLead } from "@/lib/integracoes/kommo";

type Supa = SupabaseClient<Database>;
type Tipo = SyncExecucaoRow["tipo"];

/** Dias reescritos no incremental da Meta. */
const DIAS_INCREMENTAL_META = 7;

const hojeBrt = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const fimDoMes = (iso: string) => {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};
const menor = (a: string, b: string) => (a < b ? a : b);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** BU de um funil pelo nome (P1): "Footlink…" → footlink; Footure PRO / Insights → fora; o resto é Academy. */
export function buPeloNomeDoFunil(nome: string): BuFunil {
  const n = nome.trim().toLowerCase();
  if (n.startsWith("footlink")) return "footlink";
  if (n.startsWith("footure pro") || n.startsWith("footure insights")) return "fora";
  return "academy";
}

export interface ResultadoSincronizacao {
  fonte: "meta" | "kommo";
  conta: string | null;
  tipo: Tipo;
  status: SyncExecucaoRow["status"];
  linhas: number;
  erro?: string;
}

interface Contexto {
  supabase: Supa;
  prazo: number; // epoch ms: não começa fatia nova depois disso
  tipoIncremental: Tipo; // 'incremental' (cron) ou 'manual' (botão)
  disparadoPor: string | null;
}

const temTempo = (ctx: Contexto) => Date.now() < ctx.prazo;

async function upsertEmLotes<T extends keyof Database["public"]["Tables"]>(supabase: Supa, tabela: T, linhas: Database["public"]["Tables"][T]["Insert"][]) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from(tabela).upsert(linhas.slice(i, i + 500) as never);
    if (error) throw new Error(`Falha ao gravar ${String(tabela)}: ${error.message}`);
  }
}

async function abrirExecucao(ctx: Contexto, dados: Pick<SyncExecucaoRow, "fonte" | "conta" | "tipo"> & Partial<SyncExecucaoRow>) {
  const { data, error } = await ctx.supabase
    .from("mkt_sync_execucoes")
    .insert({ ...dados, status: "rodando", disparado_por: ctx.disparadoPor })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha ao registrar a execução: ${error?.message}`);
  return data.id;
}

async function fecharExecucao(ctx: Contexto, id: string, campos: Partial<SyncExecucaoRow>) {
  await ctx.supabase
    .from("mkt_sync_execucoes")
    .update({ ...campos, terminado_em: new Date().toISOString() })
    .eq("id", id);
}

/** Última carga de histórico de uma fonte/conta (para retomar ou saber se terminou). */
async function ultimoBackfill(ctx: Contexto, fonte: "meta" | "kommo", conta: string | null) {
  let consulta = ctx.supabase.from("mkt_sync_execucoes").select("*").eq("fonte", fonte).eq("tipo", "backfill");
  consulta = conta ? consulta.eq("conta", conta) : consulta.is("conta", null);
  const { data } = await consulta.order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
  return data;
}

// ───────────────────────────── Meta ─────────────────────────────

function linhasCampanha(conta: string, linhas: LinhaMeta[]): Database["public"]["Tables"]["mkt_meta_campanha_dia"]["Insert"][] {
  const agora = new Date().toISOString();
  return linhas
    .filter((l) => l.campaign_id && l.dia)
    .map((l) => ({
      account_id: conta,
      campaign_id: l.campaign_id,
      dia: l.dia,
      campaign_name: l.campaign_name,
      spend: l.spend,
      impressions: l.impressions,
      frequency: l.frequency,
      leads: l.leads,
      purchases: l.purchases,
      actions_raw: l.actions_raw,
      sincronizado_em: agora,
    }));
}

function linhasAnuncio(conta: string, linhas: LinhaMeta[]): Database["public"]["Tables"]["mkt_meta_anuncio_dia"]["Insert"][] {
  const agora = new Date().toISOString();
  return linhas
    .filter((l) => l.ad_id && l.dia)
    .map((l) => ({
      account_id: conta,
      ad_id: l.ad_id!,
      dia: l.dia,
      campaign_id: l.campaign_id || null,
      campaign_name: l.campaign_name,
      adset_id: l.adset_id,
      adset_name: l.adset_name,
      ad_name: l.ad_name,
      spend: l.spend,
      impressions: l.impressions,
      frequency: l.frequency,
      leads: l.leads,
      purchases: l.purchases,
      actions_raw: l.actions_raw,
      sincronizado_em: agora,
    }));
}

async function puxarMeta(ctx: Contexto, conta: string, de: string, ate: string, nivel: NivelMeta) {
  const linhas = await buscarInsightsMeta(conta, de, ate, nivel);
  if (nivel === "campaign") await upsertEmLotes(ctx.supabase, "mkt_meta_campanha_dia", linhasCampanha(conta, linhas));
  else await upsertEmLotes(ctx.supabase, "mkt_meta_anuncio_dia", linhasAnuncio(conta, linhas));
  return linhas.length;
}

/**
 * Uma conta da Meta: continua a carga do histórico (nível campanha mês a mês
 * desde backfill_desde; nível anúncio mês a mês na janela de N dias) ou, com
 * ela pronta, reescreve os últimos 7 dias dos dois níveis.
 */
async function sincronizarConta(ctx: Contexto, conta: string, config: { backfillDesde: string; janelaAnuncio: number }): Promise<ResultadoSincronizacao> {
  const hoje = hojeBrt();
  const inicioAnuncio = somarDias(hoje, -(config.janelaAnuncio - 1));
  const anterior = await ultimoBackfill(ctx, "meta", conta);

  if (!anterior || anterior.status !== "ok") {
    const cursor = (anterior?.cursor as { campanha?: string; anuncio?: string } | null) ?? {};
    let campanha = cursor.campanha ?? config.backfillDesde;
    let anuncio = cursor.anuncio && cursor.anuncio > inicioAnuncio ? cursor.anuncio : inicioAnuncio;
    const id = anterior && anterior.status !== "ok" ? anterior.id : await abrirExecucao(ctx, { fonte: "meta", conta, tipo: "backfill", janela_de: config.backfillDesde, janela_ate: hoje });
    if (anterior) await ctx.supabase.from("mkt_sync_execucoes").update({ status: "rodando", erro: null, janela_ate: hoje }).eq("id", id);
    let linhas = anterior?.linhas_gravadas ?? 0;
    try {
      while (campanha <= hoje && temTempo(ctx)) {
        const fim = menor(fimDoMes(campanha), hoje);
        linhas += await puxarMeta(ctx, conta, campanha, fim, "campaign");
        campanha = somarDias(fim, 1);
        await ctx.supabase.from("mkt_sync_execucoes").update({ cursor: { campanha, anuncio }, linhas_gravadas: linhas }).eq("id", id);
      }
      while (campanha > hoje && anuncio <= hoje && temTempo(ctx)) {
        const fim = menor(fimDoMes(anuncio), hoje);
        linhas += await puxarMeta(ctx, conta, anuncio, fim, "ad");
        anuncio = somarDias(fim, 1);
        await ctx.supabase.from("mkt_sync_execucoes").update({ cursor: { campanha, anuncio }, linhas_gravadas: linhas }).eq("id", id);
      }
      const pronto = campanha > hoje && anuncio > hoje;
      await fecharExecucao(ctx, id, { status: pronto ? "ok" : "parcial", linhas_gravadas: linhas, cursor: { campanha, anuncio } });
      return { fonte: "meta", conta, tipo: "backfill", status: pronto ? "ok" : "parcial", linhas };
    } catch (e) {
      await fecharExecucao(ctx, id, { status: "erro", erro: mensagem(e), linhas_gravadas: linhas, cursor: { campanha, anuncio } });
      return { fonte: "meta", conta, tipo: "backfill", status: "erro", linhas, erro: mensagem(e) };
    }
  }

  const de = somarDias(hoje, -(DIAS_INCREMENTAL_META - 1));
  const id = await abrirExecucao(ctx, { fonte: "meta", conta, tipo: ctx.tipoIncremental, janela_de: de, janela_ate: hoje });
  try {
    const linhas = (await puxarMeta(ctx, conta, de, hoje, "campaign")) + (await puxarMeta(ctx, conta, de, hoje, "ad"));
    // Nível anúncio só guarda a janela recente.
    await ctx.supabase.from("mkt_meta_anuncio_dia").delete().eq("account_id", conta).lt("dia", inicioAnuncio);
    await fecharExecucao(ctx, id, { status: "ok", linhas_gravadas: linhas });
    return { fonte: "meta", conta, tipo: ctx.tipoIncremental, status: "ok", linhas };
  } catch (e) {
    await fecharExecucao(ctx, id, { status: "erro", erro: mensagem(e) });
    return { fonte: "meta", conta, tipo: ctx.tipoIncremental, status: "erro", linhas: 0, erro: mensagem(e) };
  }
}

/** Bucket privado das miniaturas (0048). */
export const BUCKET_CRIATIVOS = "marketing-criativos";
/** Miniaturas baixadas por execução (cada uma ~0,5 s) — o resto fica para a próxima. */
const LIMITE_MINIATURAS = 150;

/** Sem imagem original, tenta de novo depois de alguns dias (o criativo pode ter mudado). */
const DIAS_NOVA_TENTATIVA_ORIGINAL = 7;

/**
 * Imagens (0048), páginas de destino, parâmetros de URL e status (0050) dos
 * anúncios com dados na janela recente. Destino, parâmetros e status são
 * atualizados em toda execução; a imagem
 * só é baixada se falta (ou se é só a miniatura há mais de 7 dias): a
 * original em "<conta>/<anúncio>-original.<ext>". Falha aqui não afeta os números.
 */
async function sincronizarMiniaturas(ctx: Contexto, conta: string) {
  const [{ data: anuncios }, { data: guardados }] = await Promise.all([
    ctx.supabase.from("mkt_meta_anuncio_dia").select("ad_id").eq("account_id", conta),
    ctx.supabase.from("mkt_meta_criativos").select("ad_id, imagem_path, atualizado_em").eq("account_id", conta),
  ]);
  const todos = [...new Set((anuncios ?? []).map((a) => a.ad_id))];
  if (!todos.length) return 0;
  const limite = new Date(Date.now() - DIAS_NOVA_TENTATIVA_ORIGINAL * 86_400_000).toISOString();
  const existentes = new Set((guardados ?? []).map((g) => g.ad_id));
  const resolvido = new Set((guardados ?? []).filter((g) => g.imagem_path?.includes("-original") || g.atualizado_em > limite).map((g) => g.ad_id));
  const pendentes = new Set(todos.filter((id) => !resolvido.has(id)).slice(0, LIMITE_MINIATURAS));

  // Uma leitura para todos os anúncios da janela: o destino pode mudar (0050); a imagem só baixa se faltar.
  let gravadas = 0;
  for (const m of await buscarImagensCriativosMeta(conta, todos)) {
    if (!temTempo(ctx)) break;
    if (!pendentes.has(m.adId)) {
      if (existentes.has(m.adId))
        await ctx.supabase.from("mkt_meta_criativos").update({ urls_destino: m.destinos, url_tags: m.urlTags, status_anuncio: m.status }).eq("ad_id", m.adId);
      continue;
    }
    let caminho: string | null = null;
    if (m.url) {
      try {
        const resposta = await fetch(m.url);
        if (resposta.ok) {
          const tipo = resposta.headers.get("content-type") ?? "image/jpeg";
          const ext = tipo.includes("png") ? "png" : "jpg";
          caminho = `${conta}/${m.adId}${m.original ? "-original" : ""}.${ext}`;
          const { error } = await ctx.supabase.storage.from(BUCKET_CRIATIVOS).upload(caminho, await resposta.arrayBuffer(), { contentType: tipo, upsert: true });
          if (error) throw new Error(error.message);
        }
      } catch (e) {
        console.error(`[marketing] imagem do anúncio ${m.adId}:`, mensagem(e));
        continue; // tenta de novo na próxima execução
      }
    }
    await ctx.supabase
      .from("mkt_meta_criativos")
      .upsert({
        ad_id: m.adId,
        account_id: conta,
        creative_id: m.creativeId,
        imagem_path: caminho,
        urls_destino: m.destinos,
        url_tags: m.urlTags,
        status_anuncio: m.status,
        atualizado_em: new Date().toISOString(),
      });
    gravadas++;
  }
  return gravadas;
}

// ───────────────────────────── Kommo ─────────────────────────────

/** Funis e etapas (todo run) e a BU de cada funil; descobre o campo de primeiro toque. */
async function sincronizarFunis(ctx: Contexto, campos: KommoCampos) {
  const funis = await buscarFunisKommo();
  const { data: atuais } = await ctx.supabase.from("mkt_kommo_funis").select("pipeline_id, bu, bu_manual");
  const manual = new Map((atuais ?? []).filter((f) => f.bu_manual).map((f) => [f.pipeline_id, f.bu]));
  const agora = new Date().toISOString();
  await upsertEmLotes(
    ctx.supabase,
    "mkt_kommo_funis",
    funis.map((f) => ({ pipeline_id: f.pipeline_id, nome: f.nome, bu: manual.get(f.pipeline_id) ?? buPeloNomeDoFunil(f.nome), bu_manual: manual.has(f.pipeline_id), sincronizado_em: agora })),
  );
  await upsertEmLotes(ctx.supabase, "mkt_kommo_etapas", funis.flatMap((f) => f.etapas));

  if (campos.ftp_utm_campaign === null) {
    const ftp = (await buscarCamposLeadKommo()).find((c) => /ftp_utm_campaign/i.test(c.nome) || /ftp_utm_campaign/i.test(c.code ?? ""));
    if (ftp) {
      campos = { ...campos, ftp_utm_campaign: ftp.id };
      await ctx.supabase.from("mkt_configuracao").update({ kommo_campos: campos, atualizado_em: agora }).eq("id", true);
    }
  }

  const sortDe = new Map(funis.flatMap((f) => f.etapas.map((e) => [`${e.pipeline_id}:${e.status_id}`, e.sort] as const)));
  const sortMql = new Map<number, number>();
  for (const f of funis) {
    const mql = f.etapas.find((e) => e.eh_mql);
    if (mql) sortMql.set(f.pipeline_id, mql.sort);
  }
  return { campos, sortDe, sortMql };
}

async function sincronizarKommo(ctx: Contexto, campos: KommoCampos, backfillDesde: string): Promise<ResultadoSincronizacao> {
  let mapas: Awaited<ReturnType<typeof sincronizarFunis>>;
  try {
    mapas = await sincronizarFunis(ctx, campos);
  } catch (e) {
    const id = await abrirExecucao(ctx, { fonte: "kommo", conta: null, tipo: ctx.tipoIncremental });
    await fecharExecucao(ctx, id, { status: "erro", erro: mensagem(e) });
    return { fonte: "kommo", conta: null, tipo: ctx.tipoIncremental, status: "erro", linhas: 0, erro: mensagem(e) };
  }

  const anterior = await ultimoBackfill(ctx, "kommo", null);
  const backfill = !anterior || anterior.status !== "ok";
  let filtro: { campo: "created_at" | "updated_at"; desde: number };
  let pagina = 1;
  let id: string;
  let linhas = 0;
  if (backfill) {
    filtro = { campo: "created_at", desde: Math.floor(Date.parse(`${backfillDesde}T00:00:00-03:00`) / 1000) };
    pagina = (anterior?.cursor as { pagina?: number } | null)?.pagina ?? 1;
    linhas = anterior?.linhas_gravadas ?? 0;
    id = anterior ? anterior.id : await abrirExecucao(ctx, { fonte: "kommo", conta: null, tipo: "backfill", janela_de: backfillDesde, janela_ate: hojeBrt() });
    if (anterior) await ctx.supabase.from("mkt_sync_execucoes").update({ status: "rodando", erro: null }).eq("id", id);
  } else {
    // Incremental: atualizados desde a última execução boa − 1 dia de margem.
    const { data: ultimaOk } = await ctx.supabase
      .from("mkt_sync_execucoes")
      .select("iniciado_em")
      .eq("fonte", "kommo")
      .eq("status", "ok")
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = ultimaOk ? Date.parse(ultimaOk.iniciado_em) : Date.now();
    filtro = { campo: "updated_at", desde: Math.floor((base - 86_400_000) / 1000) };
    id = await abrirExecucao(ctx, { fonte: "kommo", conta: null, tipo: ctx.tipoIncremental, janela_de: new Date(filtro.desde * 1000).toISOString().slice(0, 10), janela_ate: hojeBrt() });
  }

  try {
    let acabou = false;
    while (temTempo(ctx)) {
      const leads = await buscarPaginaLeadsKommo(pagina, filtro);
      if (!leads) {
        acabou = true;
        break;
      }
      const agora = new Date().toISOString();
      await upsertEmLotes(
        ctx.supabase,
        "mkt_kommo_leads",
        leads.map((l) => ({ ...normalizarLead(l, mapas.campos, mapas.sortDe, mapas.sortMql), sincronizado_em: agora })),
      );
      linhas += leads.length;
      pagina++;
      if (backfill) await ctx.supabase.from("mkt_sync_execucoes").update({ cursor: { pagina }, linhas_gravadas: linhas }).eq("id", id);
      await esperar(200);
    }
    const status = acabou ? "ok" : "parcial";
    await fecharExecucao(ctx, id, { status, linhas_gravadas: linhas, cursor: { pagina } });
    return { fonte: "kommo", conta: null, tipo: backfill ? "backfill" : ctx.tipoIncremental, status, linhas };
  } catch (e) {
    await fecharExecucao(ctx, id, { status: "erro", erro: mensagem(e), linhas_gravadas: linhas, cursor: { pagina } });
    return { fonte: "kommo", conta: null, tipo: backfill ? "backfill" : ctx.tipoIncremental, status: "erro", linhas, erro: mensagem(e) };
  }
}

/**
 * Sincroniza Meta (cada conta ativa) e Kommo. `prazoMs`: tempo disponível —
 * nenhuma fatia nova começa depois disso (a função da Vercel tem limite).
 * Uma execução "rodando" antiga (função interrompida) é tratada como parcial.
 */
export async function sincronizarMarketing(
  supabase: Supa,
  opcoes: { origem: "cron" | "manual"; disparadoPor?: string | null; prazoMs: number },
): Promise<ResultadoSincronizacao[]> {
  const ctx: Contexto = {
    supabase,
    prazo: Date.now() + opcoes.prazoMs,
    tipoIncremental: opcoes.origem === "cron" ? "incremental" : "manual",
    disparadoPor: opcoes.disparadoPor ?? null,
  };
  const [{ data: config }, { data: contas }] = await Promise.all([
    supabase.from("mkt_configuracao").select("*").eq("id", true).single(),
    supabase.from("mkt_contas").select("account_id").eq("ativa", true),
  ]);
  if (!config) throw new Error("Configuração do Marketing não encontrada (migration 0047).");

  const resultados: ResultadoSincronizacao[] = [];
  // Kommo primeiro: é o que sustenta MQL, vendas e receita; a Meta depois, conta a conta.
  resultados.push(await sincronizarKommo(ctx, config.kommo_campos, config.backfill_desde));
  for (const c of contas ?? []) {
    if (!temTempo(ctx)) break;
    resultados.push(await sincronizarConta(ctx, c.account_id, { backfillDesde: config.backfill_desde, janelaAnuncio: config.janela_anuncio_dias }));
  }
  // Por último, a ilustração dos criativos (não entra no resultado: não afeta números).
  for (const c of contas ?? []) {
    if (!temTempo(ctx)) break;
    try {
      await sincronizarMiniaturas(ctx, c.account_id);
    } catch (e) {
      console.error(`[marketing] miniaturas da conta ${c.account_id}:`, mensagem(e));
    }
  }
  return resultados;
}

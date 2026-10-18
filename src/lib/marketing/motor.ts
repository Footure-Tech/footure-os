// Motor de atribuição, maturidade e recomendação do Marketing — TypeScript
// puro, sem banco (docs/modulo-marketing-spec.md §4.3). Porte de
// marketing/meta_kommo_join.py (maturidade, métricas, tendência de CPL) e de
// marketing/avaliar_ranking.py (saturação, ações por criativo e recomendações
// por campanha). As mensagens e a ordem das regras são as dos scripts.
import type { LimiaresMarketing } from "@/lib/supabase/database.types";

/** Sem acento, minúsculo, espaços colapsados (chave fraca: nome do criativo). */
export function normalizarNome(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Divisão que devolve null (vazio na tela) quando o denominador é zero. */
export const razao = (a: number, b: number) => (b ? a / b : null);

/**
 * Maturidade de safra: mediana de dias lead→venda dos ganhos (elemento n//2 da
 * lista ordenada, como no script; 7 dias sem ganhos) e o corte — leads criados
 * até (lead mais recente da base − mediana) estão maduros.
 */
export function maturidade(ganhos: Array<number | null>, criados: string[]) {
  const dias = ganhos.filter((d): d is number => d !== null).sort((a, b) => a - b);
  const mediana = dias.length ? dias[Math.floor(dias.length / 2)] : 7;
  const referencia = criados.reduce((max, c) => (c > max ? c : max), "");
  const corte = referencia ? new Date(Date.parse(referencia) - mediana * 86_400_000).toISOString() : new Date().toISOString();
  return { mediana, corte };
}

export interface AmostraSaturacao {
  leads: number;
  freqMedia: number | null;
  cplIni: number | null;
  cplFim: number | null;
}

/** Saturação: frequência ≥ 3 ou CPL da 2ª metade ≥ 1,3× o da 1ª, com leads ≥ 30. */
export function saturacao(a: AmostraSaturacao, l: LimiaresMarketing): { saturando: boolean; motivo: string } {
  if (a.leads < l.min_leads) return { saturando: false, motivo: "" };
  if (a.freqMedia !== null && a.freqMedia >= l.freq_alerta) return { saturando: true, motivo: `frequência ${a.freqMedia.toFixed(1).replace(".", ",")} (público vendo demais)` };
  if (a.cplIni && a.cplFim !== null && a.cplFim >= a.cplIni * l.cpl_piora)
    return { saturando: true, motivo: `CPL subiu de ${moeda(a.cplIni)} para ${moeda(a.cplFim)} na janela (fadiga)` };
  return { saturando: false, motivo: "" };
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moedaInteira = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dec = (v: number) => v.toFixed(2).replace(".", ",");

export type Acao = "ESCALAR" | "MANTER" | "REVISAR" | "PAUSAR" | "OBSERVAR";
export const ORDEM_ACAO: Record<Acao, number> = { ESCALAR: 0, PAUSAR: 1, REVISAR: 2, MANTER: 3, OBSERVAR: 4 };

export interface ItemAvaliado extends AmostraSaturacao {
  gasto: number;
  leadsMaduros: number;
  mql: number;
  vendas: number;
  receita: number;
  jovem: boolean;
  recuperados: number;
}

/** Ação por criativo (porte literal de avaliar_ranking.avaliar; a primeira regra que bate decide). */
export function avaliarCriativo(r: ItemAvaliado, l: LimiaresMarketing): { acao: Acao; motivo: string } {
  const roas = r.gasto ? r.receita / r.gasto : null;
  const cac = razao(r.gasto, r.vendas);
  const sat = saturacao(r, l);
  const ressalva = r.recuperados && r.leads && r.recuperados / r.leads >= 0.5 ? " ⚠ Apoiado em dado recuperado por nome — confirme com dado limpo." : "";

  if (r.jovem) return { acao: "OBSERVAR", motivo: "Leads recentes demais para julgar; deixar maturar." + ressalva };
  if (r.vendas === 0) {
    if (r.leadsMaduros >= l.min_leads && r.mql === 0)
      return {
        acao: "REVISAR",
        motivo: `Gastou ${moedaInteira(r.gasto)}, ${r.leadsMaduros} leads maduros, 0 MQL e 0 venda — se não for isca de topo, é candidato a pausar ou renovar a peça.` + ressalva,
      };
    return { acao: "OBSERVAR", motivo: "Sem venda ainda; volume ou maturidade insuficientes para condenar." + ressalva };
  }
  const conf = r.vendas >= l.min_vendas_confia ? "" : ` (só ${r.vendas} ${r.vendas === 1 ? "venda" : "vendas"} — sinal fraco)`;
  // Tem venda mas sem receita atribuída: lacuna de rastreio, não decisão de mídia.
  if (!r.receita || roas === null)
    return {
      acao: "REVISAR",
      motivo: `${r.vendas} ${r.vendas === 1 ? "venda registrada" : "vendas registradas"} mas sem receita atribuída — a receita não chega à junção (ex.: venda no Hotmart ou funil sem valor). Resolver o rastreio antes de julgar.` + ressalva,
    };
  if (roas < l.roas_piso) return { acao: "PAUSAR", motivo: `ROAS ${dec(roas)} < ${dec(l.roas_piso)}: a mídia não se paga${conf}.` + ressalva };
  if (roas >= l.roas_escalar && r.vendas >= l.min_vendas_confia) {
    if (sat.saturando)
      return { acao: "MANTER", motivo: `ROAS ${dec(roas)} bom, mas saturando (${sat.motivo}) — antes de subir verba, renove o criativo ou amplie o público.` + ressalva };
    return { acao: "ESCALAR", motivo: `ROAS ${dec(roas)}, CAC ${cac !== null ? moeda(cac) : "—"} — subir verba em incrementos de 20–30%, vigiando o CPL.` + ressalva };
  }
  return { acao: "MANTER", motivo: `ROAS ${dec(roas)} positivo mas magro; otimizar antes de escalar${conf}.` + ressalva };
}

export interface CriativoCampanha extends AmostraSaturacao {
  id: string;
  nome: string;
  gasto: number;
}

/** Recomendações de criativo por campanha (porte de rec_campanha): concentração, peça nova, renovar, poucos ativos. */
export function recomendacoesCampanha(criativos: CriativoCampanha[], l: LimiaresMarketing): Array<{ titulo: string; texto: string }> {
  const ativos = criativos.filter((c) => c.gasto > 0);
  const totalLeads = ativos.reduce((s, c) => s + c.leads, 0) || 1;
  const top = ativos.reduce<CriativoCampanha | null>((m, c) => (!m || c.leads > m.leads ? c : m), null);
  const recs: Array<{ titulo: string; texto: string }> = [];
  if (top) {
    const share = top.leads / totalLeads;
    const sat = saturacao(top, l);
    if (share >= l.concentracao)
      recs.push({
        titulo: "Suba 1–2 criativos novos",
        texto: `A campanha depende de um só criativo ("${top.nome}" concentra ${Math.round(share * 100)}% dos leads). Diversificar reduz o risco de fadiga.`,
      });
    if (sat.saturando)
      recs.push({ titulo: "Hora de peça nova", texto: `O principal criativo ("${top.nome}") está saturando — ${sat.motivo}. Introduza um criativo novo antes que o custo suba mais.` });
  }
  for (const c of ativos) {
    const sat = saturacao(c, l);
    if (sat.saturando && c !== top) recs.push({ titulo: `Renovar "${c.nome}"`, texto: `${sat.motivo.charAt(0).toUpperCase()}${sat.motivo.slice(1)}.` });
  }
  if (ativos.length <= 2)
    recs.push({ titulo: `Poucos criativos ativos (${ativos.length})`, texto: "Teste novas peças para o algoritmo ter com que trabalhar." });
  if (!recs.length) recs.push({ titulo: "Manter o rodízio normal", texto: "Sem alerta de saturação ou concentração." });
  return recs;
}

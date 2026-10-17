// Relatório de vendas por curso (Academy): KPIs, séries, quebras e insights
// calculados em runtime a partir das vendas da edição (carregarVendasAcademy).
// Eixo temporal: data da venda (decisão de produto, out/2026). Canceladas ficam
// fora de tudo daqui — aparecem só na lista de compradores, marcadas.
//
// Oculto por falta de dado de origem (Fase 1, out/2026): líquido após comissão
// (sem regra de comissão; o Bling não registra vendedor), quebra e insight por
// faixa Oferta × Pré-Venda (sem regra definida) e quebra por canal (o Bling não
// registra canal).
import { ALIQUOTA_IMPOSTOS_ACADEMY, type VendaAcademy } from "./vendas";
import { agruparSemanal, somarDias, type PontoSerie } from "./series";

export type PeriodoCurso = "tudo" | "90d" | "30d";
export const DIAS_PERIODO: Record<Exclude<PeriodoCurso, "tudo">, number> = { "90d": 90, "30d": 30 };

export const WIDGETS_OCULTOS = [
  { widget: "Líquido após comissão", motivo: "sem regra de comissão definida — o Bling não registra vendedor nem comissão nas vendas do Academy" },
  { widget: "Quebra e insight por faixa (Oferta × Pré-Venda)", motivo: "sem regra para identificar a faixa da venda" },
  { widget: "Quebra por canal (Site × Vendedor)", motivo: "o Bling não registra o canal da venda" },
];

const DIA = 86_400_000;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
const soma = (vs: VendaAcademy[], campo: (v: VendaAcademy) => number) => vs.reduce((s, v) => s + campo(v), 0);
const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })}%`;
const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface QuebraPagamento {
  rotulo: string;
  vendas: number;
  valor: number;
  taxa: number;
  participacao: number;
}

export interface Insight {
  titulo: string;
  texto: string;
}

export interface RelatorioCurso {
  inicio: string;
  fim: string;
  dias: number;
  kpis: {
    vendas: number;
    bruto: number;
    taxas: number;
    impostos: number;
    liquido: number;
    /** Vendas com a taxa estimada pela forma de pagamento (ainda sem baixa no Bling). */
    taxasEstimadas: number;
    ticketMedio: number;
    faturamentoDia: number;
    emAberto: number;
  };
  /** Série diária do período (dias sem venda com zero); a semanal é agregada na tela. */
  diaria: PontoSerie[];
  pagamentos: QuebraPagamento[];
  insights: Insight[];
}

/** Início e fim do recorte: a edição inteira (1ª à última venda) ou os últimos N dias até hoje. */
export function intervaloDoPeriodo(periodo: PeriodoCurso, primeiraVenda: string, ultimaVenda: string, hoje: string) {
  if (periodo === "tudo") return { inicio: primeiraVenda, fim: ultimaVenda };
  return { inicio: somarDias(hoje, -(DIAS_PERIODO[periodo] - 1)), fim: hoje };
}

export function montarRelatorioCurso(vendasEdicao: VendaAcademy[], inicio: string, fim: string): RelatorioCurso {
  const vendas = vendasEdicao.filter((v) => v.dataVenda >= inicio && v.dataVenda <= fim);
  const dias = diasEntre(inicio, fim) + 1;
  const bruto = soma(vendas, (v) => v.valorTotal);
  const taxas = soma(vendas, (v) => v.taxa);
  const impostos = soma(vendas, (v) => v.impostos);

  const porDia = new Map<string, PontoSerie>();
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) porDia.set(d, { chave: d, valor: 0, quantidade: 0 });
  for (const v of vendas) {
    const p = porDia.get(v.dataVenda)!;
    p.valor += v.valorTotal;
    p.quantidade++;
  }
  const diaria = [...porDia.values()];

  const formas = new Map<string, QuebraPagamento>();
  for (const v of vendas) {
    for (const p of v.pagamentos) {
      const q = formas.get(p.rotulo) ?? { rotulo: p.rotulo, vendas: 0, valor: 0, taxa: 0, participacao: 0 };
      q.vendas++;
      q.valor += p.valor;
      q.taxa += p.taxa;
      formas.set(p.rotulo, q);
    }
  }
  const pagamentos = [...formas.values()].map((q) => ({ ...q, participacao: pct(q.valor, bruto) })).sort((a, b) => b.valor - a.valor);

  return {
    inicio,
    fim,
    dias,
    kpis: {
      vendas: vendas.length,
      bruto,
      taxas,
      impostos,
      liquido: bruto - taxas - impostos,
      taxasEstimadas: vendas.filter((v) => !v.taxaReal).length,
      ticketMedio: vendas.length ? bruto / vendas.length : 0,
      faturamentoDia: bruto / dias,
      emAberto: vendas.filter((v) => v.situacao === "em_aberto").length,
    },
    diaria,
    pagamentos,
    insights: gerarInsights(vendas, diaria, pagamentos, { bruto, taxas, impostos }),
  };
}

/** Amostra pequena: linguagem de observação, sem projeção. */
const AMOSTRA_PEQUENA = 20;

/**
 * Insights automáticos (4 a 6), todos dos números do recorte. Cada um só
 * aparece quando há dado suficiente; com amostra pequena, o texto descreve o
 * que aconteceu, sem falar em tendência.
 */
function gerarInsights(
  vendas: VendaAcademy[],
  diaria: PontoSerie[],
  pagamentos: QuebraPagamento[],
  totais: { bruto: number; taxas: number; impostos: number },
): Insight[] {
  const insights: Insight[] = [];
  const n = vendas.length;
  if (n === 0 || totais.bruto <= 0) return insights;
  const pequena = n < AMOSTRA_PEQUENA;
  const ressalva = pequena ? ` Amostra pequena (${n} vendas): vale como observação, não como tendência.` : "";

  // 1. Primeira × segunda metade do recorte.
  if (diaria.length >= 14 && n >= 6) {
    const meio = Math.floor(diaria.length / 2);
    const a = diaria.slice(0, meio).reduce((s, d) => s + d.valor, 0);
    const b = diaria.slice(meio).reduce((s, d) => s + d.valor, 0);
    const variacao = a > 0 ? ((b - a) / a) * 100 : null;
    const titulo = variacao === null ? "Vendas só na segunda metade" : variacao >= 15 ? "Segunda metade mais forte" : variacao <= -15 ? "Segunda metade mais fraca" : "Ritmo estável entre as metades";
    insights.push({
      titulo,
      texto:
        `Primeira metade (até ${fmtData(diaria[meio - 1].chave)}): ${fmtMoeda(a)}. Segunda metade: ${fmtMoeda(b)}` +
        (variacao === null ? "." : ` (${variacao >= 0 ? "+" : ""}${fmtPct(variacao)}).`) +
        ressalva,
    });
  }

  // 2. Semana e dia de pico.
  if (n >= 5) {
    const semanas = agruparSemanal(diaria);
    const semana = semanas.reduce((m, s) => (s.valor > m.valor ? s : m), semanas[0]);
    const dia = diaria.reduce((m, d) => (d.valor > m.valor ? d : m), diaria[0]);
    insights.push({
      titulo: "Pico de vendas",
      texto: `A semana de ${fmtData(semana.chave)} somou ${fmtMoeda(semana.valor)} (${fmtPct(pct(semana.valor, totais.bruto))} do total). O melhor dia foi ${fmtData(dia.chave)}, com ${dia.quantidade} ${dia.quantidade === 1 ? "venda" : "vendas"} e ${fmtPct(pct(dia.valor, totais.bruto))} do total.`,
    });
  }

  // 3. Concentração em rajadas × fluxo contínuo.
  if (diaria.length >= 14 && n >= 5) {
    const comVenda = diaria.filter((d) => d.quantidade > 0).length;
    let seca = 0;
    let maiorSeca = 0;
    let fimSeca = "";
    for (const d of diaria) {
      seca = d.quantidade > 0 ? 0 : seca + 1;
      if (seca > maiorSeca) {
        maiorSeca = seca;
        fimSeca = d.chave;
      }
    }
    const top3 = [...diaria].sort((a, b) => b.valor - a.valor).slice(0, 3).reduce((s, d) => s + d.valor, 0);
    const rajada = pct(comVenda, diaria.length) < 35 && pct(top3, totais.bruto) >= 40;
    insights.push({
      titulo: rajada ? "Vendas em rajadas" : "Fluxo de vendas mais contínuo",
      texto:
        `Houve venda em ${comVenda} de ${diaria.length} dias (${fmtPct(pct(comVenda, diaria.length))}); os 3 melhores dias somam ${fmtPct(pct(top3, totais.bruto))} do faturamento.` +
        (maiorSeca >= 7 ? ` Maior intervalo sem vendas: ${maiorSeca} dias (até ${fmtData(fimSeca)}).` : "") +
        (rajada ? " Padrão típico de campanha." : ""),
    });
  }

  // 4. Forma de pagamento de maior taxa.
  const comTaxa = pagamentos.filter((p) => p.taxa > 0 && p.valor > 0);
  if (totais.taxas > 0 && comTaxa.length) {
    const cara = comTaxa.reduce((m, p) => (p.taxa / p.valor > m.taxa / m.valor ? p : m), comTaxa[0]);
    insights.push({
      titulo: `${cara.rotulo}: a forma mais cara`,
      texto: `Taxa efetiva de ${fmtPct(pct(cara.taxa, cara.valor))}. Responde por ${fmtPct(pct(cara.valor, totais.bruto))} do faturamento e ${fmtPct(pct(cara.taxa, totais.taxas))} das taxas (${fmtMoeda(cara.taxa)}).`,
    });
  }

  // 5. Quanto do bruto sobra como líquido.
  const liquido = totais.bruto - totais.taxas - totais.impostos;
  insights.push({
    titulo: `${fmtPct(pct(liquido, totais.bruto))} do bruto vira líquido`,
    texto: `De ${fmtMoeda(totais.bruto)} vendidos, saem ${fmtMoeda(totais.taxas)} em taxas de pagamento (${fmtPct(pct(totais.taxas, totais.bruto))}) e ${fmtMoeda(totais.impostos)} em impostos (${fmtPct(ALIQUOTA_IMPOSTOS_ACADEMY * 100)}), restando ${fmtMoeda(liquido)}.`,
  });

  return insights.slice(0, 6);
}

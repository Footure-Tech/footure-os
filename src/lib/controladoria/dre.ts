// DRE gerencial (spec §3.3) sobre o plano de contas do Bling. Cada lançamento
// cai numa linha da DRE pela raiz da categoria; o detalhe da linha é o nível
// seguinte do plano. Distribuição de lucros e empréstimos não são resultado:
// ficam em "Fora do resultado" (e no Caixa).
//
// Regimes: competência = data de competência do Bling (cai para a emissão e o
// vencimento); caixa = só o que foi pago/recebido, pelo vencimento (o Bling
// não traz a data da baixa na listagem).
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { BaseControladoria, Lancamento } from "./indicadores";
import { deslocarMes, emAberto } from "./modelo";

export type RegimeDre = "competencia" | "caixa";

export const LINHAS_NEGOCIO = ["Footlink", "Academy", "Capital", "Pro", "Media"] as const;

type ChaveLinha =
  | "receita"
  | "deducoes"
  | "custos"
  | "pessoal"
  | "comercial"
  | "administrativas"
  | "cartao"
  | "financeiro"
  | "outras"
  | "ir"
  | "fora";

const ROTULO: Record<ChaveLinha, string> = {
  receita: "Receita bruta",
  deducoes: "(−) Deduções e impostos sobre vendas",
  custos: "(−) Custos diretos",
  pessoal: "(−) Pessoal (PJ, pró-labore, benefícios, comissões)",
  comercial: "(−) Comercial e marketing",
  administrativas: "(−) Administrativas",
  cartao: "(−) Faturas de cartão sem abertura",
  financeiro: "(+/−) Resultado financeiro",
  outras: "(+/−) Outras receitas e despesas",
  ir: "(−) IR e CSLL",
  fora: "Fora do resultado",
};

const partes = (l: Lancamento) => l.categoria?.caminho.split(" › ") ?? [];

/** Linha da DRE e o detalhe (nível seguinte do plano de contas) de um lançamento. */
function classificar(l: Lancamento): { linha: ChaveLinha; detalhe: string } {
  const [raiz = "", n1, n2] = partes(l);
  const r = raiz.toLowerCase();
  const detalhe = n1 ?? raiz ?? "";
  if (!l.categoria) return { linha: "outras", detalhe: l.tipo === "receber" ? "Receitas sem categoria" : "Despesas sem categoria" };
  if (l.categoria.distribuicaoLucros || l.categoria.emprestimo) return { linha: "fora", detalhe: l.categoria.distribuicaoLucros ? "Distribuição de lucros" : raiz };

  if (l.tipo === "receber") {
    if (/^vendas de/.test(r)) return { linha: "receita", detalhe: n1 && LINHAS_NEGOCIO.includes(n1 as (typeof LINHAS_NEGOCIO)[number]) ? n1 : "Outras vendas" };
    if (/rendimento|juros recebidos/.test(r)) return { linha: "financeiro", detalhe: raiz };
    return { linha: "outras", detalhe: raiz };
  }

  if (/devolu[cç][oõ]es de vendas|descontos incondicionais/.test(r)) return { linha: "deducoes", detalhe: "Devoluções e descontos" };
  if (r === "despesas tributárias") return n1 && /impostos sobre vendas/i.test(n1) ? { linha: "deducoes", detalhe: "Impostos sobre vendas (DAS)" } : { linha: "administrativas", detalhe: `Tributos e taxas${n1 ? ` · ${n1}` : ""}` };
  if (/^custo d/.test(r)) return { linha: "custos", detalhe: n1 && n1 !== "Geral" ? n1 : "Geral" };
  if (/^compra/.test(r)) {
    if (l.categoria.faturaCartao) return { linha: "cartao", detalhe: n1 ?? "Cartão" };
    return { linha: "custos", detalhe: n1 ?? "Compras" };
  }
  if (r === "despesas com pessoal") return { linha: "pessoal", detalhe: n1 === "Salários" || n1 === "Estágio" ? `${n1}${n2 ? ` · ${n2}` : ""}` : detalhe };
  if (r === "despesas comerciais" || r === "marketing") return { linha: "comercial", detalhe: r === "marketing" ? `Marketing${n1 ? ` · ${n1}` : ""}` : detalhe };
  if (r === "despesas administrativas" || r === "qualidade" || r === "doações") return { linha: "administrativas", detalhe: r === "despesas administrativas" ? detalhe : raiz };
  if (/despesas financeiras|juros e encargos|varia[cç][oõ]es cambiais/.test(r)) return { linha: "financeiro", detalhe: n1 ?? raiz };
  if (/imposto de renda|contribui[cç][aã]o social/.test(r)) return { linha: "ir", detalhe: raiz };
  return { linha: "outras", detalhe: raiz };
}

function mesDoLancamento(l: Lancamento, regime: RegimeDre) {
  return (regime === "competencia" ? (l.competencia ?? l.data_emissao ?? l.vencimento) : l.vencimento).slice(0, 7);
}

/** Valor que entra na DRE: receita positiva, despesa negativa. No regime de caixa, só o realizado. */
function valorNoRegime(l: Lancamento, regime: RegimeDre) {
  let v = l.valor;
  if (regime === "caixa") {
    if (l.situacao === 1) return 0;
    if (l.situacao === 3) v = l.valor - l.aberto;
  }
  return l.tipo === "receber" ? v : -v;
}

export interface LinhaDre {
  chave: string;
  rotulo: string;
  tipo: "grupo" | "subtotal" | "fora";
  valores: number[];
  total: number;
  detalhes: { rotulo: string; valores: number[]; total: number }[];
}

export function calcularDre(base: BaseControladoria, regime: RegimeDre, hoje = hojeLocal()) {
  const mesAtual = hoje.slice(0, 7);
  const meses = Array.from({ length: 12 }, (_, i) => deslocarMes(mesAtual, i - 11));
  const indice = new Map(meses.map((m, i) => [m, i]));
  const vazio = () => meses.map(() => 0);
  const grupos = new Map<ChaveLinha, Map<string, number[]>>();
  let semDetalhe = 0;

  for (const l of base.lancamentos) {
    const i = indice.get(mesDoLancamento(l, regime));
    if (i === undefined) continue;
    if (!l.detalhado_em) semDetalhe++;
    const v = valorNoRegime(l, regime);
    if (!v) continue;
    const { linha, detalhe } = classificar(l);
    const g = grupos.get(linha) ?? new Map<string, number[]>();
    const arr = g.get(detalhe) ?? vazio();
    arr[i] += v;
    g.set(detalhe, arr);
    grupos.set(linha, g);
  }

  const somaArr = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);
  const total = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const grupo = (chave: ChaveLinha): LinhaDre => {
    const g = grupos.get(chave) ?? new Map<string, number[]>();
    const detalhes = [...g.entries()]
      .map(([rotulo, valores]) => ({ rotulo, valores, total: total(valores) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    const valores = detalhes.reduce((acc, d) => somaArr(acc, d.valores), vazio());
    return { chave, rotulo: ROTULO[chave], tipo: chave === "fora" ? "fora" : "grupo", valores, total: total(valores), detalhes };
  };
  const subtotal = (chave: string, rotulo: string, linhas: LinhaDre[]): LinhaDre => {
    const valores = linhas.reduce((acc, l) => somaArr(acc, l.valores), vazio());
    return { chave, rotulo, tipo: "subtotal", valores, total: total(valores), detalhes: [] };
  };

  const receita = grupo("receita");
  const deducoes = grupo("deducoes");
  const liquida = subtotal("receita_liquida", "= Receita líquida", [receita, deducoes]);
  const custos = grupo("custos");
  const margem = subtotal("margem", "= Margem de contribuição", [liquida, custos]);
  const pessoal = grupo("pessoal");
  const comercial = grupo("comercial");
  const administrativas = grupo("administrativas");
  const cartao = grupo("cartao");
  const ebitda = subtotal("ebitda", "= EBITDA gerencial", [margem, pessoal, comercial, administrativas, cartao]);
  const financeiro = grupo("financeiro");
  const outras = grupo("outras");
  const ir = grupo("ir");
  const resultado = subtotal("resultado", "= Resultado líquido", [ebitda, financeiro, outras, ir]);
  const fora = grupo("fora");

  // Margem por linha de negócio: receita da linha, DAS rateado pela receita e custos diretos da linha.
  const receitaPorLinha = new Map(receita.detalhes.map((d) => [d.rotulo, d.total]));
  const custoPorLinha = new Map(custos.detalhes.map((d) => [d.rotulo, d.total]));
  const impostos = deducoes.total;
  const porLinha = [...LINHAS_NEGOCIO, "Outras vendas"]
    .map((linha) => {
      const rec = receitaPorLinha.get(linha) ?? 0;
      const ded = receita.total ? (impostos * rec) / receita.total : 0;
      const cus = custoPorLinha.get(linha) ?? 0;
      const margemLinha = rec + ded + cus;
      return { linha, receita: rec, deducoes: ded, custos: cus, margem: margemLinha, pctMargem: rec ? margemLinha / rec : null };
    })
    .filter((l) => l.receita || l.custos);
  const custosSemLinha = [...custoPorLinha.entries()].filter(([k]) => !LINHAS_NEGOCIO.includes(k as (typeof LINHAS_NEGOCIO)[number])).reduce((s, [, v]) => s + v, 0);

  return {
    regime,
    meses,
    linhas: [receita, deducoes, liquida, custos, margem, pessoal, comercial, administrativas, cartao, ebitda, financeiro, outras, ir, resultado],
    fora,
    porLinha,
    custosSemLinha,
    semDetalhe,
    abertosNoPeriodo: base.lancamentos.filter((l) => emAberto(l.situacao) && indice.has(mesDoLancamento(l, regime))).length,
  };
}

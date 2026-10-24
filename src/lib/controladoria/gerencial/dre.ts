// DRE gerencial por competência no formato do kit gerador (compute_dados.py →
// dados_painel.json), calculada a partir dos LANÇAMENTOS do Bling — não do
// relatório exportado. Regras: docs/referencia/prompt-financeiro.md §4 e
// docs/financeiro/DECISOES.md.
//
// - Competência: mês da data de competência do título (fallback: emissão,
//   depois vencimento — contado como premissa).
// - Só meses FECHADOS do ano (o corrente e os futuros ficam fora e são listados).
// - Hierarquia: cada lançamento soma na sua categoria e em todos os
//   ancestrais; lançamento direto numa categoria que tem filhas vira a folha
//   "(sem subcategoria)". Pai + filho nunca são somados entre si.
// - Custo direto (decisão de 24/10): toda linha marcada com a BU — Compras de
//   fornecedores, Custo dos serviços prestados, Salários, Estágio, Comissões e
//   Bônus › {BU}. Overhead = despesas operacionais − custos diretos −
//   distribuição de lucros, rateado pela receita ACUMULADA do período.
import type { FinCategoriaRow } from "@/lib/supabase/database.types";
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { BaseControladoria, Lancamento } from "../indicadores";

export const BUS = ["Academy", "Capital", "Footlink", "Media", "Pro"] as const;
export type BU = (typeof BUS)[number];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Raízes do plano de contas por bloco da DRE (os nomes do Bling). */
const RECEITA_BRUTA = ["Vendas de serviços", "Vendas de produtos", "Vendas de mercadorias"];
const DEDUCOES = ["Despesas tributárias", "Devoluções de vendas", "Descontos incondicionais"];
const CUSTO_MERCADORIAS = ["Custo dos produtos vendidos", "Custo das mercadorias vendidas", "Compra de insumos e matéria prima"];
const DESPESAS_OPERACIONAIS = [
  "Compras de fornecedores",
  "Custo dos serviços prestados",
  "Despesas administrativas",
  "Despesas com pessoal",
  "Despesas comerciais",
  "Marketing",
  "Qualidade",
  "Doações",
];
const RECEITA_FINANCEIRA = ["Rendimento de aplicação financeira", "Juros recebidos"];
const DESPESA_FINANCEIRA = ["Despesas financeiras", "Juros e Encargos de Empréstimos", "Variações cambiais"];
const OUTRAS_RECEITAS = ["Indenização de seguro", "Venda de ativo", "Comissão sobre vendas e indicações"];
const OUTRAS_DESPESAS = ["Perda de capital na alienação de ativo"];
const IR_CSLL = ["Imposto de renda", "Contribuição social sobre lucro líquido"];
/** Raízes que nunca entram na DRE (movimento entre contas, ajustes e financiamento). */
const FORA_DA_DRE = /^(transferências|transferências de entrada|transferências de saída|ajuste de saldo|ajustes de caixa|depósitos|empréstimos recebidos|amortização de empréstimos)$/;
/** Grupos de Despesas com pessoal cujas filhas por BU são custo direto. */
const PESSOAL_POR_BU = ["Salários", "Estágio", "Comissões", "Bônus, doação e brindes"];

export interface LinhaDreKit {
  id: number;
  pid: number | null;
  label: string;
  level: number;
  kind: "l0" | "l1" | "l2" | "sub" | "leaf" | "grand";
  vals: number[];
  total: number;
  hasKids: boolean;
}

export interface ResultadoBU {
  receita: number;
  imposto: number;
  recliq: number;
  custo_direto: number;
  margem: number;
  margem_pct: number;
  overhead: number;
  resultado: number;
  share: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const somaArr = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);

/** Mês de competência e se ele veio do fallback (premissa). */
function mesCompetencia(l: Lancamento): { mes: string; fallback: boolean } {
  if (l.competencia) return { mes: l.competencia.slice(0, 7), fallback: false };
  return { mes: (l.data_emissao ?? l.vencimento).slice(0, 7), fallback: true };
}

export function calcularDreGerencial(base: BaseControladoria, hoje = hojeLocal()) {
  const ano = hoje.slice(0, 4);
  const mesAtual = hoje.slice(0, 7);
  const nFechados = Number(mesAtual.slice(5, 7)) - 1;
  const meses = Array.from({ length: nFechados }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const excluidos = Array.from({ length: 12 - nFechados }, (_, i) => `${ano}-${String(nFechados + i + 1).padStart(2, "0")}`);
  const idx = new Map(meses.map((m, i) => [m, i]));
  const vazio = () => meses.map(() => 0);

  // Árvore de categorias
  const cats = new Map<number, Pick<FinCategoriaRow, "id" | "id_pai" | "descricao" | "tipo">>(base.categorias.map((c) => [c.id, c]));
  const filhos = new Map<number | null, number[]>();
  for (const c of base.categorias) {
    const pai = c.id_pai && cats.has(c.id_pai) ? c.id_pai : null;
    filhos.set(pai, [...(filhos.get(pai) ?? []), c.id]);
  }

  // Valores próprios de cada categoria (só o que foi lançado nela) e o total da subárvore.
  const proprio = new Map<number, number[]>();
  const semCategoria = { receita: vazio(), despesa: vazio() };
  let fallbackCompetencia = 0;
  for (const l of base.lancamentos) {
    if (l.categoria?.emprestimo) continue; // empréstimos: fora da DRE
    const { mes, fallback } = mesCompetencia(l);
    const i = idx.get(mes);
    if (i === undefined) continue;
    if (fallback) fallbackCompetencia++;
    if (!l.categoria_id || !cats.has(l.categoria_id)) {
      (l.tipo === "receber" ? semCategoria.receita : semCategoria.despesa)[i] += l.valor;
      continue;
    }
    const arr = proprio.get(l.categoria_id) ?? vazio();
    arr[i] += l.valor;
    proprio.set(l.categoria_id, arr);
  }
  // Lançamentos feitos direto em Caixa e Bancos (tarifas, taxas, rendimentos): não existem em
  // contas a pagar/receber. Os de origem "borderô" são baixas de títulos já contados acima;
  // transferências e raízes internas/empréstimos ficam fora.
  const raizDe = (id: number) => {
    let c = cats.get(id);
    while (c?.id_pai && cats.has(c.id_pai)) c = cats.get(c.id_pai);
    return c?.descricao.trim().toLowerCase() ?? "";
  };
  let movimentosDiretos = 0;
  for (const m of base.movimentos) {
    if (m.origem_tipo === "bordero" || m.transferencia || m.debito_credito === "S") continue;
    const i = idx.get((m.competencia ?? m.data).slice(0, 7));
    if (i === undefined) continue;
    if (!m.categoria_id || !cats.has(m.categoria_id)) {
      (m.debito_credito === "C" ? semCategoria.receita : semCategoria.despesa)[i] += m.valor;
      continue;
    }
    if (FORA_DA_DRE.test(raizDe(m.categoria_id))) continue;
    // Categoria de receita (tipo 2) soma créditos; as demais somam débitos — o sentido oposto é estorno.
    const receita = cats.get(m.categoria_id)!.tipo === 2;
    const v = (m.debito_credito === "C") === receita ? m.valor : -m.valor;
    const arr = proprio.get(m.categoria_id) ?? vazio();
    arr[i] += v;
    proprio.set(m.categoria_id, arr);
    movimentosDiretos++;
  }

  const totalSub = new Map<number, number[]>();
  const calcTotal = (id: number): number[] => {
    const pronto = totalSub.get(id);
    if (pronto) return pronto;
    let t = proprio.get(id) ?? vazio();
    for (const f of filhos.get(id) ?? []) t = somaArr(t, calcTotal(f));
    totalSub.set(id, t);
    return t;
  };
  const raizPorNome = new Map((filhos.get(null) ?? []).map((id) => [cats.get(id)!.descricao.trim(), id]));
  const totalRaiz = (nome: string) => (raizPorNome.has(nome) ? calcTotal(raizPorNome.get(nome)!) : vazio());
  const totalRaizes = (nomes: string[]) => nomes.reduce((acc, n) => somaArr(acc, totalRaiz(n)), vazio());
  const filhoDe = (raiz: string, nome: string) => {
    const r = raizPorNome.get(raiz);
    const id = r ? (filhos.get(r) ?? []).find((f) => cats.get(f)!.descricao.trim() === nome) : undefined;
    return id ? calcTotal(id) : vazio();
  };
  const netoDe = (raiz: string, grupo: string, nome: string) => {
    const r = raizPorNome.get(raiz);
    const g = r ? (filhos.get(r) ?? []).find((f) => cats.get(f)!.descricao.trim() === grupo) : undefined;
    const id = g ? (filhos.get(g) ?? []).find((f) => cats.get(f)!.descricao.trim() === nome) : undefined;
    return id ? calcTotal(id) : vazio();
  };

  // Receita por BU (filhas de "Vendas de serviços") e reconciliação.
  const vendas = totalRaiz("Vendas de serviços");
  const rev_bu_month = Object.fromEntries(BUS.map((b) => [b, filhoDe("Vendas de serviços", b).map(r2)])) as Record<BU, number[]>;
  const rev_bu = Object.fromEntries(BUS.map((b) => [b, rev_bu_month[b].reduce((s, v) => s + v, 0)])) as Record<BU, number>;
  const rev_total = BUS.reduce((s, b) => s + rev_bu[b], 0);
  const vendasTotal = vendas.reduce((s, v) => s + v, 0);
  const reconciliacao = { vendas: r2(vendasTotal), somaBUs: r2(rev_total), diferenca: r2(vendasTotal - rev_total), ok: Math.abs(vendasTotal - rev_total) <= 1 };

  // Blocos
  const receitaBruta = totalRaizes(RECEITA_BRUTA);
  const deducoes = totalRaizes(DEDUCOES);
  const impostosArr = filhoDe("Despesas tributárias", "Impostos sobre vendas");
  const custoMercadorias = totalRaizes(CUSTO_MERCADORIAS);
  const despOp = totalRaizes(DESPESAS_OPERACIONAIS);
  const distribuicao = filhoDe("Despesas com pessoal", "Distribuição de lucros");
  const recFin = totalRaizes(RECEITA_FINANCEIRA);
  const despFin = totalRaizes(DESPESA_FINANCEIRA);
  const outrasRec = totalRaizes(OUTRAS_RECEITAS);
  const outrasDesp = totalRaizes(OUTRAS_DESPESAS);
  const ir = totalRaizes(IR_CSLL);

  // Custo direto por BU
  const direto = Object.fromEntries(
    BUS.map((b) => {
      let t = somaArr(filhoDe("Compras de fornecedores", b), filhoDe("Custo dos serviços prestados", b));
      for (const g of PESSOAL_POR_BU) t = somaArr(t, netoDe("Despesas com pessoal", g, b));
      return [b, t.reduce((s, v) => s + v, 0)];
    }),
  ) as Record<BU, number>;

  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const imp = sum(impostosArr);
  const desp_op = sum(despOp);
  const dist_lucros = sum(distribuicao);
  const diretoTotal = BUS.reduce((s, b) => s + direto[b], 0);
  const overhead = desp_op - diretoTotal - dist_lucros;

  const pl = Object.fromEntries(
    BUS.map((b) => {
      const share = rev_total ? rev_bu[b] / rev_total : 0;
      const receita = rev_bu[b];
      const imposto = imp * share;
      const recliq = receita - imposto;
      const margem = recliq - direto[b];
      const oh = overhead * share;
      const x: ResultadoBU = {
        receita,
        imposto,
        recliq,
        custo_direto: direto[b],
        margem,
        margem_pct: receita ? (margem / receita) * 100 : 0,
        overhead: oh,
        resultado: margem - oh,
        share: share * 100,
      };
      return [b, x];
    }),
  ) as Record<BU, ResultadoBU>;
  const comp = {
    receita: rev_total,
    imposto: imp,
    recliq: rev_total - imp,
    custo_direto: diretoTotal,
    margem: BUS.reduce((s, b) => s + pl[b].margem, 0),
    overhead,
    resultado: BUS.reduce((s, b) => s + pl[b].resultado, 0),
  };
  const ebitda = rev_total - imp - (desp_op - dist_lucros);
  const params = {
    imp_efetivo_pct: rev_total ? (imp / rev_total) * 100 : 0,
    overhead_pct_op: desp_op - dist_lucros ? (overhead / (desp_op - dist_lucros)) * 100 : 0,
    overhead_total: overhead,
    dist_lucros,
    ebitda,
    ebitda_margin: rev_total !== imp ? (ebitda / (rev_total - imp)) * 100 : 0,
  };

  // Árvore da DRE (mesmo desenho do kit: deduções/despesas como subtração)
  const dre_full: LinhaDreKit[] = [];
  let seq = 0;
  const emit = (label: string, level: number, kind: LinhaDreKit["kind"], vals: number[], pid: number | null) => {
    const id = ++seq;
    dre_full.push({ id, pid, label, level, kind, vals: vals.map(r2), total: r2(sum(vals)), hasKids: false });
    return id;
  };
  const sinal = (vals: number[], s: number) => vals.map((v) => v * s);
  const subarvore = (catId: number, level: number, pid: number, s: number) => {
    const fs = (filhos.get(catId) ?? []).filter((f) => calcTotal(f).some((v) => v !== 0));
    for (const f of fs) {
      const t = calcTotal(f);
      const nomeF = cats.get(f)!.descricao.trim();
      const temFilhos = (filhos.get(f) ?? []).length > 0;
      const id = emit(nomeF, level, level === 1 ? "l1" : level === 2 ? "l2" : temFilhos ? "sub" : "leaf", sinal(t, s), pid);
      if (temFilhos) {
        subarvore(f, level + 1, id, s);
        const p = proprio.get(f);
        if (p && p.some((v) => v !== 0)) emit("(sem subcategoria)", level + 1, "leaf", sinal(p, s), id);
      }
    }
  };
  const bloco = (label: string, raizes: string[], vals: number[], s: number) => {
    const l0 = emit(label, 0, "l0", sinal(vals, s), null);
    for (const nome of raizes) {
      const id = raizPorNome.get(nome);
      if (!id || !calcTotal(id).some((v) => v !== 0)) continue;
      const l1 = emit(nome, 1, "l1", sinal(calcTotal(id), s), l0);
      subarvore(id, 2, l1, s);
      const p = proprio.get(id);
      if (p && p.some((v) => v !== 0) && (filhos.get(id) ?? []).length) emit("(sem subcategoria)", 2, "leaf", sinal(p, s), l1);
    }
  };
  bloco("(+) Receita Operacional Bruta", RECEITA_BRUTA, receitaBruta, 1);
  bloco("(−) Deduções da Receita Bruta", DEDUCOES, deducoes, -1);
  const recLiq = receitaBruta.map((v, i) => v - deducoes[i]);
  emit("(=) Receita Operacional Líquida", 0, "l0", recLiq, null);
  bloco("(−) Custos das Mercadorias", CUSTO_MERCADORIAS, custoMercadorias, -1);
  const resBruto = recLiq.map((v, i) => v - custoMercadorias[i]);
  emit("(=) Resultado Operacional Bruto", 0, "l0", resBruto, null);
  bloco("(−) Despesas Operacionais", DESPESAS_OPERACIONAIS, despOp, -1);
  bloco("(+) Receita Financeira", RECEITA_FINANCEIRA, recFin, 1);
  bloco("(−) Despesa Financeira", DESPESA_FINANCEIRA, despFin, -1);
  bloco("(+) Outras Receitas", OUTRAS_RECEITAS, outrasRec, 1);
  bloco("(−) Outras Despesas", OUTRAS_DESPESAS, outrasDesp, -1);
  const antesIr = resBruto.map((v, i) => v - despOp[i] + recFin[i] - despFin[i] + outrasRec[i] - outrasDesp[i]);
  emit("(=) Resultado Operacional antes do IR e CSLL", 0, "l0", antesIr, null);
  bloco("(−) IR e CSLL", IR_CSLL, ir, -1);
  emit("(=) Resultado Líquido do Exercício", 0, "grand", antesIr.map((v, i) => v - ir[i]), null);
  const comFilhos = new Set(dre_full.map((r) => r.pid).filter((p): p is number => p !== null));
  for (const r of dre_full) r.hasKids = comFilhos.has(r.id);

  // Raízes que não entram em bloco nenhum (nem são transferência/empréstimo): ficam visíveis como pendência.
  const conhecidas = new Set([...RECEITA_BRUTA, ...DEDUCOES, ...CUSTO_MERCADORIAS, ...DESPESAS_OPERACIONAIS, ...RECEITA_FINANCEIRA, ...DESPESA_FINANCEIRA, ...OUTRAS_RECEITAS, ...OUTRAS_DESPESAS, ...IR_CSLL]);
  const foraDaDre = [...raizPorNome.entries()]
    .filter(([nome, id]) => !conhecidas.has(nome) && calcTotal(id).some((v) => v !== 0))
    .map(([nome, id]) => ({ raiz: nome, total: r2(sum(calcTotal(id))) }));

  return {
    regime: "competencia" as const,
    meses,
    rotulos: meses.map((m) => MESES_CURTOS[Number(m.slice(5, 7)) - 1]),
    excluidos,
    rev_bu_month,
    pl,
    comp,
    params,
    reconciliacao,
    dre_full,
    blocos: {
      receitaBruta: receitaBruta.map(r2),
      deducoes: deducoes.map(r2),
      despesasOperacionais: despOp.map(r2),
      porBlocoDespesa: Object.fromEntries(DESPESAS_OPERACIONAIS.map((n) => [n, totalRaiz(n).map(r2)])),
      resultadoLiquido: antesIr.map((v, i) => r2(v - ir[i])),
    },
    semCategoria: { receita: semCategoria.receita.map(r2), despesa: semCategoria.despesa.map(r2) },
    foraDaDre,
    premissas: { fallbackCompetencia, movimentosDiretos },
  };
}

export type DreGerencial = ReturnType<typeof calcularDreGerencial>;

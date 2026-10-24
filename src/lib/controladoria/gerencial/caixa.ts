// Balancete de caixa no formato do kit gerador (compute_caixa.py →
// dados_caixa.json e compute_semanal.py → dados_semanal.json), a partir dos
// movimentos de Caixa e Bancos do Bling (/caixas, 0065).
//
// Regras validadas contra o balancete exportado (docs/financeiro/DIVERGENCIAS.md):
// - data = data do movimento (regime de caixa);
// - transferencia = true → "Transferências de entrada/saída", fora dos totais
//   (as duas pernas se anulam no saldo);
// - categoria "Ajuste de saldo" → linha própria, fora de receitas/despesas;
// - débito/crédito "S" não entra;
// - saldo = saldos iniciais das contas + ajuste de abertura (premissa) + soma
//   de todos os movimentos anteriores.
import type { FinCategoriaRow } from "@/lib/supabase/database.types";
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { BaseControladoria } from "../indicadores";
import { BUS, type BU } from "./dre";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const AJUSTE = /^(ajuste de saldo|ajustes de caixa)$/i;
const PESSOAL_POR_BU = ["Salários", "Estágio", "Comissões", "Bônus, doação e brindes"];

type Movimento = BaseControladoria["movimentos"][number];
type Cat = Pick<FinCategoriaRow, "id" | "id_pai" | "descricao" | "tipo">;

export interface LinhaBalancete {
  id: number;
  pid: number | null;
  label: string;
  level: number;
  kind: "section" | "l0" | "l1" | "l2" | "sub" | "leaf" | "grand" | "result";
  vals: number[];
  total: number;
  hasKids: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Classificação de um movimento no balancete. */
function classificador(categorias: Cat[]) {
  const cats = new Map(categorias.map((c) => [c.id, c]));
  const caminho = (id: number | null) => {
    const out: Cat[] = [];
    for (let c = id ? cats.get(id) : undefined; c; c = c.id_pai ? cats.get(c.id_pai) : undefined) out.unshift(c);
    return out;
  };
  return (m: Movimento): { secao: "receita" | "despesa" | "transf_entrada" | "transf_saida" | "ajuste" | "fora"; caminho: Cat[] } => {
    if (m.debito_credito === "S") return { secao: "fora", caminho: [] };
    if (m.transferencia) return { secao: m.debito_credito === "C" ? "transf_entrada" : "transf_saida", caminho: [] };
    const cam = caminho(m.categoria_id);
    if (cam.length && AJUSTE.test(cam[0].descricao.trim())) return { secao: "ajuste", caminho: cam };
    return { secao: m.debito_credito === "C" ? "receita" : "despesa", caminho: cam };
  };
}

/** Soma por caminho de categoria (para montar a árvore e buscar BU/blocos). */
function acumulador(n: number) {
  const nos = new Map<string, number[]>();
  const proprios = new Map<string, number[]>();
  return {
    add(caminho: string[], i: number, v: number) {
      for (let k = 1; k <= caminho.length; k++) {
        const chave = caminho.slice(0, k).join(" › ");
        const arr = nos.get(chave) ?? Array(n).fill(0);
        arr[i] += v;
        nos.set(chave, arr);
      }
      const chave = caminho.join(" › ");
      const p = proprios.get(chave) ?? Array(n).fill(0);
      p[i] += v;
      proprios.set(chave, p);
    },
    get: (caminho: string[]) => nos.get(caminho.join(" › ")) ?? Array(n).fill(0),
    filhos(prefixo: string[]) {
      const pre = prefixo.join(" › ");
      const nivel = prefixo.length + 1;
      return [...nos.keys()].filter((k) => k.split(" › ").length === nivel && (prefixo.length === 0 || k.startsWith(`${pre} › `))).map((k) => k.split(" › ").at(-1)!);
    },
    proprio: (caminho: string[]) => proprios.get(caminho.join(" › ")),
  };
}

function abertura(base: BaseControladoria) {
  const saldosIniciais = base.contas.reduce((s, c) => s + (Number(c.saldo_inicial) || 0), 0);
  const ajuste = Number(base.premissas.saldo_abertura_ajuste) || 0;
  return { saldosIniciais, ajuste, total: saldosIniciais + ajuste };
}

/** Caixa mensal: jan do ano corrente até o mês corrente (parcial). */
export function calcularCaixaMensal(base: BaseControladoria, hoje = hojeLocal()) {
  const ano = hoje.slice(0, 4);
  const mesAtual = hoje.slice(0, 7);
  const n = Number(mesAtual.slice(5, 7));
  const meses = Array.from({ length: n }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const idx = new Map(meses.map((m, i) => [m, i]));
  const classificar = classificador(base.categorias);
  const z = () => Array(n).fill(0) as number[];

  const ab = abertura(base);
  let saldoAntes = ab.total;
  const entradas = z(), saidas = z(), tEnt = z(), tSai = z(), ajuste = z();
  const rec = acumulador(n);
  const desp = acumulador(n);
  let semDetalhe = 0;
  for (const m of base.movimentos) {
    if (m.debito_credito === "S") continue;
    const sinal = m.debito_credito === "C" ? 1 : -1;
    const mes = m.data.slice(0, 7);
    if (mes < meses[0]) {
      saldoAntes += sinal * m.valor;
      continue;
    }
    const i = idx.get(mes);
    if (i === undefined) continue;
    if (!m.detalhado_em) semDetalhe++;
    const { secao, caminho } = classificar(m);
    const nomes = caminho.length ? caminho.map((c) => c.descricao.trim()) : ["Sem categoria"];
    if (secao === "transf_entrada") tEnt[i] += m.valor;
    else if (secao === "transf_saida") tSai[i] += m.valor;
    else if (secao === "ajuste") ajuste[i] += sinal * m.valor;
    else if (secao === "receita") {
      entradas[i] += m.valor;
      rec.add(nomes, i, m.valor);
    } else if (secao === "despesa") {
      saidas[i] += m.valor;
      desp.add(nomes, i, m.valor);
    }
  }
  const resultado = meses.map((_, i) => entradas[i] - saidas[i]);
  const saldo_ini = z(), saldo_fim = z();
  let s = saldoAntes;
  meses.forEach((_, i) => {
    saldo_ini[i] = s;
    s += resultado[i] + ajuste[i] + tEnt[i] - tSai[i];
    saldo_fim[i] = s;
  });

  // Árvore (receitas e despesas como no balancete; despesas como subtração)
  const tree: LinhaBalancete[] = [];
  let seq = 0;
  const emit = (label: string, level: number, kind: LinhaBalancete["kind"], vals: number[], pid: number | null, total?: number) => {
    const id = ++seq;
    tree.push({ id, pid, label, level, kind, vals: vals.map(r2), total: r2(total ?? soma(vals)), hasKids: false });
    return id;
  };
  const galho = (acc: ReturnType<typeof acumulador>, prefixo: string[], pid: number, sinal: number) => {
    for (const nome of acc.filhos(prefixo).sort((a, b) => a.localeCompare(b, "pt-BR"))) {
      const cam = [...prefixo, nome];
      const level = cam.length;
      const temFilhos = acc.filhos(cam).length > 0;
      const id = emit(nome, level, level === 1 ? "l1" : level === 2 ? "l2" : temFilhos ? "sub" : "leaf", acc.get(cam).map((v) => v * sinal), pid);
      if (temFilhos) {
        galho(acc, cam, id, sinal);
        const p = acc.proprio(cam);
        if (p?.some((v) => v)) emit("(sem subcategoria)", level + 1, "leaf", p.map((v) => v * sinal), id);
      }
    }
  };
  emit("Saldo inicial", 0, "l0", saldo_ini, null, saldo_ini[0]);
  const sRec = emit("Receitas", 0, "section", z(), null);
  galho(rec, [], sRec, 1);
  const sDesp = emit("Despesas", 0, "section", z(), null);
  galho(desp, [], sDesp, -1);
  const sTe = emit("Transferências de entrada", 0, "section", z(), null);
  emit("Transferências de entrada", 1, "leaf", tEnt, sTe);
  const sTs = emit("Transferências de saída", 0, "section", z(), null);
  emit("Transferências de saída", 1, "leaf", tSai.map((v) => -v), sTs);
  const sRes = emit("Resultado", 0, "section", z(), null);
  emit("Total de receitas", 1, "result", entradas, sRes);
  emit("Total de despesas", 1, "result", saidas, sRes);
  emit("Receitas - Despesas", 1, "grand", resultado, sRes);
  emit("Ajuste Saldo", 0, "l0", ajuste, null);
  emit("Saldo final", 0, "l0", saldo_fim, null, saldo_fim[n - 1]);
  const pais = new Set(tree.map((t) => t.pid).filter((p): p is number => p !== null));
  for (const t of tree) t.hasKids = pais.has(t.id);

  // Macro (como o kit), sobre os meses FECHADOS; o mês corrente vem à parte (parcial).
  const nf = n - 1;
  const fech = <T,>(a: T[]) => a.slice(0, nf);
  const somaF = (a: number[]) => soma(fech(a));
  const vendas = rec.get(["Vendas de serviços"]);
  const depositos = rec.get(["Depósitos"]);
  const distribuicao = desp.get(["Despesas com pessoal", "Distribuição de lucros"]);
  const transfDesp = desp.get(["Transferências"]);
  const resF = fech(resultado);
  const burn3 = resF.length >= 3 ? soma(resF.slice(-3)) / 3 : resF.length ? soma(resF) / resF.length : 0;
  const caixaFechado = nf > 0 ? saldo_fim[nf - 1] : saldo_ini[0];
  const macro = {
    caixa_atual: caixaFechado,
    caixa_hoje: saldo_fim[n - 1],
    saldo_ini: saldo_ini[0],
    var_caixa: caixaFechado - saldo_ini[0],
    resultado_caixa: soma(resF),
    entradas: somaF(entradas),
    saidas: somaF(saidas),
    vendas_recebidas: somaF(vendas),
    depositos: somaF(depositos),
    distribuicao: somaF(distribuicao),
    transferencias: somaF(transfDesp),
    meses_neg: resF.filter((v) => v < 0).length,
    burn3,
    runway_meses: burn3 < 0 ? caixaFechado / Math.abs(burn3) : null,
  };

  // Geração de caixa por BU (regime de caixa) — mesma regra de custo direto da DRE.
  const rev_bu_m = Object.fromEntries(BUS.map((b) => [b, rec.get(["Vendas de serviços", b]).map(r2)])) as Record<BU, number[]>;
  const rev_bu = Object.fromEntries(BUS.map((b) => [b, somaF(rev_bu_m[b])])) as Record<BU, number>;
  const revTotal = BUS.reduce((t, b) => t + rev_bu[b], 0);
  const direto = Object.fromEntries(
    BUS.map((b) => {
      let t = somaF(desp.get(["Compras de fornecedores", b])) + somaF(desp.get(["Custo dos serviços prestados", b]));
      for (const g of PESSOAL_POR_BU) t += somaF(desp.get(["Despesas com pessoal", g, b]));
      return [b, t];
    }),
  ) as Record<BU, number>;
  const impostos = somaF(desp.get(["Despesas tributárias", "Impostos sobre vendas"]));
  const despOp = macro.saidas - macro.distribuicao - macro.transferencias;
  const overhead = despOp - BUS.reduce((t, b) => t + direto[b], 0) - impostos;
  const bu = BUS.map((b) => {
    const sh = revTotal ? rev_bu[b] / revTotal : 0;
    const receita = rev_bu[b];
    const imposto = impostos * sh;
    const margem = receita - imposto - direto[b];
    const oh = overhead * sh;
    return { bu: b, receita, imposto, recliq: receita - imposto, direto: direto[b], margem, margem_pct: receita ? (margem / receita) * 100 : 0, overhead: oh, resultado: margem - oh, share: sh * 100 };
  });

  return {
    regime: "caixa" as const,
    meses,
    rotulos: meses.map((m) => MESES_CURTOS[Number(m.slice(5, 7)) - 1]),
    mesParcial: mesAtual,
    abertura: ab,
    serie: {
      saldo_ini: saldo_ini.map(r2),
      saldo_fim: saldo_fim.map(r2),
      entradas: entradas.map(r2),
      saidas: saidas.map(r2),
      resultado: resultado.map(r2),
      transf_entrada: tEnt.map(r2),
      transf_saida: tSai.map(r2),
      ajuste: ajuste.map(r2),
    },
    macro,
    bu,
    rev_bu,
    rev_bu_m,
    overhead,
    impostos,
    balancete: tree,
    semDetalhe,
  };
}

/** Semanas do Bling: domingo a sábado, cortadas no mês. */
export function semanasDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const semanas: { inicio: string; fim: string }[] = [];
  let ini = 1;
  for (let d = 1; d <= ultimo; d++) {
    const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    if (dow === 6 || d === ultimo) {
      semanas.push({ inicio: `${mes}-${String(ini).padStart(2, "0")}`, fim: `${mes}-${String(d).padStart(2, "0")}` });
      ini = d + 1;
    }
  }
  return semanas;
}

/** Caixa semanal de um mês (padrão: o corrente), com entradas por BU e não-BU e saídas por bloco. */
export function calcularCaixaSemanal(base: BaseControladoria, mes = hojeLocal().slice(0, 7), hoje = hojeLocal()) {
  const semanas = semanasDoMes(mes);
  const nw = semanas.length;
  const qual = (d: string) => semanas.findIndex((s) => d >= s.inicio && d <= s.fim);
  const classificar = classificador(base.categorias);
  const z = () => Array(nw).fill(0) as number[];
  let saldoAntes = abertura(base).total;
  const entradas = z(), saidas = z(), tEnt = z(), tSai = z(), ajuste = z();
  const ent: Record<string, number[]> = {};
  const sai: Record<string, number[]> = {};
  const naoBu: string[] = [];
  for (const m of base.movimentos) {
    if (m.debito_credito === "S") continue;
    const sinal = m.debito_credito === "C" ? 1 : -1;
    if (m.data < semanas[0].inicio) {
      saldoAntes += sinal * m.valor;
      continue;
    }
    const w = qual(m.data);
    if (w < 0) continue;
    const { secao, caminho } = classificar(m);
    const nomes = caminho.length ? caminho.map((c) => c.descricao.trim()) : ["Sem categoria"];
    if (secao === "transf_entrada") tEnt[w] += m.valor;
    else if (secao === "transf_saida") tSai[w] += m.valor;
    else if (secao === "ajuste") ajuste[w] += sinal * m.valor;
    else if (secao === "receita") {
      entradas[w] += m.valor;
      const chave = nomes[0] === "Vendas de serviços" ? (nomes[1] && (BUS as readonly string[]).includes(nomes[1]) ? nomes[1] : "Vendas de serviços (sem BU)") : nomes[0];
      (ent[chave] ??= z())[w] += m.valor;
      if (!(BUS as readonly string[]).includes(chave) && !naoBu.includes(chave)) naoBu.push(chave);
    } else if (secao === "despesa") {
      saidas[w] += m.valor;
      (sai[nomes[0]] ??= z())[w] += m.valor;
    }
  }
  const resultado = semanas.map((_, i) => entradas[i] - saidas[i]);
  const saldo_ini = z(), saldo_fim = z();
  let s = saldoAntes;
  semanas.forEach((_, i) => {
    saldo_ini[i] = s;
    s += resultado[i] + ajuste[i] + tEnt[i] - tSai[i];
    saldo_fim[i] = s;
  });
  let partial_from = nw - 1;
  const iHoje = qual(hoje);
  if (iHoje >= 0) partial_from = iHoje;
  else if (hoje < semanas[0].inicio) partial_from = 0;
  const fechado = hoje > semanas[nw - 1].fim;
  const alertas: string[] = [];
  const somaLinhas = (o: Record<string, number[]>) => Object.values(o).reduce((t, a) => t + soma(a), 0);
  if (Math.abs(somaLinhas(ent) - soma(entradas)) > 1) alertas.push(`Entradas não reconciliam: linhas ${r2(somaLinhas(ent))} × total ${r2(soma(entradas))}.`);
  if (Math.abs(somaLinhas(sai) - soma(saidas)) > 1) alertas.push(`Saídas não reconciliam: linhas ${r2(somaLinhas(sai))} × total ${r2(soma(saidas))}.`);
  const arred = (o: Record<string, number[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.map(r2)]));
  return {
    regime: "caixa" as const,
    mes,
    semanas,
    partial_from,
    fechado,
    saldo_ini: saldo_ini.map(r2),
    saldo_fim: saldo_fim.map(r2),
    entradas: entradas.map(r2),
    saidas: saidas.map(r2),
    resultado: resultado.map(r2),
    transferencias: { entrada: tEnt.map(r2), saida: tSai.map(r2) },
    ajuste: ajuste.map(r2),
    entradas_bu: arred(ent),
    saidas_cat: arred(sai),
    entradasNaoBu: naoBu,
    reconciliado: alertas.length === 0,
    alertas,
  };
}

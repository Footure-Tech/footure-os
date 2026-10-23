// Fluxo de caixa (spec §3.2): 6 meses realizados + o mês corrente + 5 meses
// projetados, e a projeção de 13 semanas. Separa o operacional do que é
// financiamento (empréstimos) e distribuição de lucros. Projeção = só o que já
// está lançado no Bling (sem vendas novas); o cenário conservador aplica às
// entradas a inadimplência observada.
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { BaseControladoria, Lancamento } from "./indicadores";
import { calcularCaixa, dataBaseDosSaldos, projetarSaldo } from "./indicadores";
import { deslocarMes, emAberto, somarDias } from "./modelo";

export type CenarioCaixa = "base" | "conservador";

const soma = <T,>(itens: T[], valor: (x: T) => number) => itens.reduce((s, x) => s + valor(x), 0);

/** Parte do lançamento que conta como caixa no mês: passado = realizado; futuro = em aberto. */
function valorDeCaixa(l: Lancamento, mes: string, mesAtual: string, hoje: string, fatorEntradas: number) {
  const realizado = l.situacao === 2 ? l.valor : l.situacao === 3 ? l.valor - l.aberto : 0;
  if (mes < mesAtual) return realizado;
  // Mês corrente e futuros: o realizado + o que ainda está em aberto e não venceu
  // (pagar vencido em aberto também sai; receber vencido não entra).
  let aberto = emAberto(l.situacao) ? l.aberto : 0;
  if (aberto && l.vencimento < hoje && l.tipo === "receber") aberto = 0;
  if (l.tipo === "receber") aberto *= fatorEntradas;
  return realizado + aberto;
}

/** Inadimplência observada: parcelas que venceram entre 180 e 30 dias atrás e seguem em aberto, sobre o total delas. */
export function taxaInadimplencia(base: BaseControladoria, hoje = hojeLocal()) {
  const janela = base.lancamentos.filter(
    (l) => l.tipo === "receber" && !l.categoria?.emprestimo && l.vencimento >= somarDias(hoje, -180) && l.vencimento < somarDias(hoje, -30),
  );
  const total = soma(janela, (l) => l.valor);
  return total ? soma(janela.filter((l) => emAberto(l.situacao)), (l) => l.aberto) / total : 0;
}

export function calcularFluxoCaixa(base: BaseControladoria, cenario: CenarioCaixa, hoje = hojeLocal()) {
  const mesAtual = hoje.slice(0, 7);
  const meses = Array.from({ length: 12 }, (_, i) => deslocarMes(mesAtual, i - 6));
  const inad = taxaInadimplencia(base, hoje);
  const fator = cenario === "conservador" ? 1 - inad : 1;
  const caixa = calcularCaixa(base, hoje);

  type Grupo = "entradas" | "saidas" | "emprestimos" | "distribuicao";
  const detalhes: Record<Grupo, Map<string, number[]>> = { entradas: new Map(), saidas: new Map(), emprestimos: new Map(), distribuicao: new Map() };
  const vazio = () => meses.map(() => 0);
  for (const l of base.lancamentos) {
    const mes = l.vencimento.slice(0, 7);
    const i = meses.indexOf(mes);
    if (i < 0) continue;
    const v = valorDeCaixa(l, mes, mesAtual, hoje, fator);
    if (!v) continue;
    const grupo: Grupo = l.categoria?.distribuicaoLucros ? "distribuicao" : l.categoria?.emprestimo ? "emprestimos" : l.tipo === "receber" ? "entradas" : "saidas";
    const partes = l.categoria?.caminho.split(" › ") ?? [];
    const rotulo =
      grupo === "entradas"
        ? (/^vendas de/i.test(partes[0] ?? "") ? partes[1] : partes[0]) || "Sem categoria"
        : grupo === "saidas"
          ? partes[0] || "Sem categoria"
          : partes[0] || "—";
    const arr = detalhes[grupo].get(rotulo) ?? vazio();
    arr[i] += l.tipo === "receber" ? v : -v;
    detalhes[grupo].set(rotulo, arr);
  }
  const linha = (grupo: Grupo) => {
    const itens = [...detalhes[grupo].entries()].map(([rotulo, valores]) => ({ rotulo, valores, total: soma(valores, (x) => x) })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    return { itens, valores: meses.map((_, i) => soma(itens, (d) => d.valores[i])) };
  };
  const entradas = linha("entradas");
  const saidas = linha("saidas");
  const emprestimos = linha("emprestimos");
  const distribuicao = linha("distribuicao");
  const operacional = meses.map((_, i) => entradas.valores[i] + saidas.valores[i]);
  const variacao = meses.map((_, i) => operacional[i] + emprestimos.valores[i] + distribuicao.valores[i]);

  // Saldo projetado ao fim de cada mês (do mês corrente em diante), a partir do saldo de hoje.
  const dataBase = dataBaseDosSaldos(base.contas);
  const dias = 31 * 6;
  const { saldoHoje, projecao } = projetarSaldo(base, dataBase, hoje, dias, fator);
  const saldoFimDoMes = meses.map((m) => {
    if (m < mesAtual || !projecao.length) return null;
    const doMes = projecao.filter((d) => d.data.startsWith(m));
    return doMes.length ? doMes.at(-1)!.saldo : null;
  });
  const faltaColchao = saldoFimDoMes.map((s) => (s === null ? null : Math.max(0, caixa.colchao - s)));

  // 13 semanas.
  const semanas = Array.from({ length: 13 }, (_, i) => {
    const dias7 = projecao.slice(i * 7, i * 7 + 7);
    if (!dias7.length) return null;
    return { inicio: dias7[0].data, fim: dias7.at(-1)!.data, entradas: soma(dias7, (d) => d.entradas), saidas: soma(dias7, (d) => d.saidas), saldoFinal: dias7.at(-1)!.saldo };
  }).filter((s): s is NonNullable<typeof s> => !!s);
  const menorSemana = semanas.length ? semanas.reduce((m, s) => (s.saldoFinal < m.saldoFinal ? s : m), semanas[0]) : null;

  return {
    cenario,
    inadimplencia: inad,
    meses,
    mesAtual,
    entradas,
    saidas,
    operacional,
    emprestimos,
    distribuicao,
    variacao,
    saldoFimDoMes,
    faltaColchao,
    semanas,
    menorSemana,
    saldoHoje,
    dataBase,
    colchao: caixa.colchao,
    recebiveisVencidos: soma(
      base.lancamentos.filter((l) => l.tipo === "receber" && emAberto(l.situacao) && l.vencimento < hoje && !l.categoria?.emprestimo),
      (l) => l.aberto,
    ),
  };
}

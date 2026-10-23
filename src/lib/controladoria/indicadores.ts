// Indicadores da Controladoria (0061), calculados sobre o cache do Bling.
// Fluxos por VENCIMENTO (o Bling não traz a data de baixa na listagem);
// transferências e ajustes entre contas ficam fora de tudo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinContaFinanceiraRow, FinLancamentoRow, FinPremissasRow } from "@/lib/supabase/database.types";
import { carregarBaseParcelas, hojeLocal, montarContratosDaBase, mrrDoContrato } from "@/lib/financeiro/carteira";
import {
  CAMADAS_CAIXA,
  SITUACAO_EM_ABERTO,
  deslocarMes,
  diasEntre,
  emAberto,
  formaSemCobrancaManual,
  mapaDeCategorias,
  situacaoValida,
  somarDias,
  type InfoCategoria,
} from "./modelo";

type Supa = SupabaseClient<Database>;

/** Lançamento do cache já com categoria, conta e nome resolvidos. */
export interface Lancamento extends FinLancamentoRow {
  categoria: InfoCategoria | null;
  conta: FinContaFinanceiraRow | null;
  forma: { descricao: string; tipo: number | null } | null;
  nome: string;
  /** Valor ainda em aberto (saldo do detalhe quando parcial). */
  aberto: number;
}

async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const linhas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await consulta(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error(`[controladoria] ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) return linhas;
  }
}

export async function carregarBaseControladoria(supabase: Supa) {
  const [lancamentosBrutos, categorias, contas, formas, contatos, premissas, execucao] = await Promise.all([
    lerTudo((de, ate) => supabase.from("fin_lancamentos").select("*").order("id").range(de, ate)),
    lerTudo((de, ate) => supabase.from("fin_categorias").select("id, id_pai, descricao").range(de, ate)),
    lerTudo((de, ate) => supabase.from("fin_contas_financeiras").select("*").order("descricao").range(de, ate)),
    lerTudo((de, ate) => supabase.from("fin_formas_pagamento").select("id, descricao, tipo_pagamento").range(de, ate)),
    lerTudo((de, ate) => supabase.from("fin_contatos").select("id, nome").range(de, ate)),
    supabase.from("fin_premissas").select("*").eq("id", true).single(),
    supabase
      .from("bling_sync_execucoes")
      .select("status, erro, iniciado_em, terminado_em, resumo")
      .eq("resumo->>etapa", "controladoria")
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (premissas.error) throw new Error(`[controladoria] premissas: ${premissas.error.message}`);

  const categoria = mapaDeCategorias(categorias);
  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  const formaPorId = new Map(formas.map((f) => [f.id, { descricao: f.descricao, tipo: f.tipo_pagamento }]));
  const nomePorContato = new Map(contatos.map((c) => [c.id, c.nome]));

  const lancamentos: Lancamento[] = lancamentosBrutos
    .map((l) => ({
      ...l,
      valor: Number(l.valor),
      saldo: l.saldo === null ? null : Number(l.saldo),
      categoria: categoria(l.categoria_id),
      conta: l.conta_financeira_id ? (contaPorId.get(l.conta_financeira_id) ?? null) : null,
      forma: l.forma_pagamento_id ? (formaPorId.get(l.forma_pagamento_id) ?? null) : null,
      nome: l.contato_nome || (l.contato_id ? nomePorContato.get(l.contato_id) : null) || "—",
      aberto: l.situacao === SITUACAO_EM_ABERTO ? Number(l.valor) : l.saldo && Number(l.saldo) > 0 ? Number(l.saldo) : Number(l.valor),
    }))
    .filter((l) => situacaoValida(l.situacao) && !l.categoria?.interna);

  return {
    lancamentos,
    contas: contas.map((c) => ({ ...c, saldo_informado: c.saldo_informado === null ? null : Number(c.saldo_informado) })),
    premissas: premissas.data as FinPremissasRow,
    ultimaExecucao: execucao.data,
    pendentesDetalhe: lancamentosBrutos.filter((l) => !l.detalhado_em && (emAberto(l.situacao) || l.vencimento >= somarDias(hojeLocal(), -730))).length,
  };
}

export type BaseControladoria = Awaited<ReturnType<typeof carregarBaseControladoria>>;

const soma = <T,>(itens: T[], valor: (x: T) => number) => itens.reduce((s, x) => s + valor(x), 0);
const realizado = (l: Lancamento) => !emAberto(l.situacao) || l.situacao === 3;
const valorRealizado = (l: Lancamento) => (l.situacao === 3 ? l.valor - l.aberto : l.valor);

export interface DiaProjecao {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

/** Data dos saldos informados (a mais recente entre as contas de caixa). */
export function dataBaseDosSaldos(contas: BaseControladoria["contas"]) {
  const informadas = contas.filter((c) => CAMADAS_CAIXA.includes(c.camada) && c.saldo_informado !== null && c.saldo_informado_em);
  return informadas.length ? informadas.map((c) => c.saldo_informado_em!).sort().at(-1)! : null;
}

/**
 * Projeção diária do caixa disponível (contas + liquidez em 1 dia) a partir dos
 * saldos informados: o que venceu desde a data dos saldos e já foi baixado
 * aconteceu; o que está em aberto entra no vencimento — pagar vencido entra
 * hoje, receber vencido fica de fora (prudência). `fatorEntradas` < 1 aplica
 * a inadimplência esperada (cenário conservador).
 */
export function projetarSaldo(base: BaseControladoria, dataBase: string | null, hoje: string, dias: number, fatorEntradas = 1) {
  if (!dataBase) return { saldoHoje: null as number | null, projecao: [] as DiaProjecao[] };
  const { lancamentos, contas } = base;
  const base0 = soma(contas.filter((c) => CAMADAS_CAIXA.includes(c.camada)), (c) => c.saldo_informado ?? 0);
  // Só o que venceu DEPOIS do dia dos saldos e até hoje: o extrato daquele dia já
  // inclui o que venceu nele e o que foi pago adiantado (vencimento futuro).
  const desdeBase = lancamentos.filter((l) => l.vencimento > dataBase && l.vencimento <= hoje && realizado(l));
  const saldoHoje = base0 + soma(desdeBase, (l) => (l.tipo === "receber" ? valorRealizado(l) : -valorRealizado(l)));
  const abertos = lancamentos.filter((l) => emAberto(l.situacao));
  const projecao: DiaProjecao[] = [];
  let saldo = saldoHoje;
  for (let i = 0; i <= dias; i++) {
    const data = somarDias(hoje, i);
    const doDia = abertos.filter((l) => (l.tipo === "pagar" && i === 0 ? l.vencimento <= data : l.vencimento === data));
    const entradas = soma(doDia.filter((l) => l.tipo === "receber"), (l) => l.aberto) * fatorEntradas;
    const saidas = soma(doDia.filter((l) => l.tipo === "pagar"), (l) => l.aberto);
    saldo += entradas - saidas;
    projecao.push({ data, entradas, saidas, saldo });
  }
  return { saldoHoje, projecao };
}

/** Posição de caixa, projeção de 30 dias, queima e colchão. */
export function calcularCaixa(base: BaseControladoria, hoje = hojeLocal()) {
  const { lancamentos, contas, premissas } = base;
  const caixaContas = contas.filter((c) => c.camada !== "ignorar" && c.camada !== "cartao");
  const saldoDa = (camada: FinContaFinanceiraRow["camada"]) => soma(contas.filter((c) => c.camada === camada), (c) => c.saldo_informado ?? 0);
  const contasDeCaixa = contas.filter((c) => CAMADAS_CAIXA.includes(c.camada));
  const dataBase = dataBaseDosSaldos(contas);

  // Médias dos 3 meses fechados (por vencimento): saídas sem distribuição de lucros; entradas sem empréstimos.
  const mesAtual = hoje.slice(0, 7);
  const meses = [3, 2, 1].map((n) => deslocarMes(mesAtual, -n));
  const doMes = (l: Lancamento, mes: string) => l.vencimento.startsWith(mes);
  const saidasMes = meses.map((m) => soma(lancamentos.filter((l) => l.tipo === "pagar" && doMes(l, m) && !l.categoria?.distribuicaoLucros), (l) => l.valor));
  const entradasMes = meses.map((m) => soma(lancamentos.filter((l) => l.tipo === "receber" && doMes(l, m) && !l.categoria?.emprestimo), (l) => l.valor));
  const saidasMedias = soma(saidasMes, (v) => v) / 3;
  const entradasMedias = soma(entradasMes, (v) => v) / 3;
  const queima = Math.max(0, saidasMedias - entradasMedias);
  const colchao = premissas.colchao_meses * saidasMedias;

  const disponivel = saldoDa("disponivel");
  const liquidez = saldoDa("liquidez");
  const aplicacao = saldoDa("aplicacao");
  const gateway = saldoDa("gateway");
  const totalComAplicacoes = disponivel + liquidez + aplicacao;
  const runwayMeses = queima > 0 ? totalComAplicacoes / queima : null;

  const { saldoHoje, projecao } = projetarSaldo(base, dataBase, hoje, 30);
  const minimo = projecao.length ? projecao.reduce((m, d) => (d.saldo < m.saldo ? d : m), projecao[0]) : null;
  const semanas = Array.from({ length: 4 }, (_, i) => {
    const dias = projecao.slice(i * 7 + (i === 0 ? 0 : 1), (i + 1) * 7 + 1);
    return dias.length
      ? { inicio: dias[0].data, fim: dias.at(-1)!.data, entradas: soma(dias, (d) => d.entradas), saidas: soma(dias, (d) => d.saidas), saldoFinal: dias.at(-1)!.saldo }
      : null;
  }).filter((s): s is NonNullable<typeof s> => !!s);

  return {
    disponivel,
    liquidez,
    aplicacao,
    gateway,
    caixa: disponivel + liquidez,
    dataBase,
    saldoHoje,
    contasCaixa: caixaContas,
    contasSemSaldo: contasDeCaixa.filter((c) => c.saldo_informado === null),
    contasDesatualizadas: contasDeCaixa.filter((c) => c.saldo_informado_em && diasEntre(c.saldo_informado_em, hoje) > premissas.dias_conciliacao),
    saidasMedias,
    entradasMedias,
    mesesBase: meses,
    queima,
    colchao,
    runwayMeses,
    projecao,
    minimo,
    semanas,
  };
}

/** Recebíveis vencidos em aberto, por faixa de atraso. */
export function calcularRecebiveis(base: BaseControladoria, hoje = hojeLocal()) {
  const vencidos = base.lancamentos.filter((l) => l.tipo === "receber" && emAberto(l.situacao) && l.vencimento < hoje && !l.categoria?.emprestimo);
  const faixa = (min: number, max: number) => vencidos.filter((l) => diasEntre(l.vencimento, hoje) >= min && diasEntre(l.vencimento, hoje) <= max);
  const antigos = faixa(base.premissas.receber_antigo_dias + 1, 100_000);
  return {
    total: soma(vencidos, (l) => l.aberto),
    ate90: soma(faixa(1, 90), (l) => l.aberto),
    de91: soma(faixa(91, 100_000), (l) => l.aberto),
    antigos: { valor: soma(antigos, (l) => l.aberto), qtd: antigos.length },
    semCobranca: base.lancamentos.filter(
      (l) =>
        l.tipo === "receber" &&
        l.situacao === SITUACAO_EM_ABERTO &&
        l.vencimento >= hoje &&
        l.vencimento <= somarDias(hoje, base.premissas.cobranca_antecedencia_dias) &&
        l.tem_cobranca === false &&
        !formaSemCobrancaManual(l.forma?.tipo ?? null, l.forma?.descricao ?? ""),
    ),
  };
}

/** Entradas e saídas com vencimento no mês corrente: previsto (tudo) e já realizado. */
export function calcularMes(base: BaseControladoria, hoje = hojeLocal()) {
  const mes = hoje.slice(0, 7);
  const doMes = base.lancamentos.filter((l) => l.vencimento.startsWith(mes) && !l.categoria?.emprestimo);
  const entradas = doMes.filter((l) => l.tipo === "receber");
  const saidas = doMes.filter((l) => l.tipo === "pagar");
  return {
    mes,
    entradasPrevistas: soma(entradas, (l) => l.valor),
    entradasRealizadas: soma(entradas.filter(realizado), valorRealizado),
    saidasPrevistas: soma(saidas, (l) => l.valor),
    saidasRealizadas: soma(saidas.filter(realizado), valorRealizado),
  };
}

/** Agenda: pagar vencido e tudo que vence nos próximos `dias` dias, por dia. */
export function calcularAgenda(base: BaseControladoria, hoje = hojeLocal(), dias = 7) {
  const abertos = base.lancamentos.filter((l) => emAberto(l.situacao));
  const pagarVencidos = abertos.filter((l) => l.tipo === "pagar" && l.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const porDia = Array.from({ length: dias }, (_, i) => {
    const data = somarDias(hoje, i);
    const itens = abertos.filter((l) => l.vencimento === data).sort((a, b) => b.aberto - a.aberto);
    return {
      data,
      pagar: itens.filter((l) => l.tipo === "pagar"),
      receber: itens.filter((l) => l.tipo === "receber"),
    };
  });
  return { pagarVencidos, porDia };
}

/** MRR do Footlink pelo mesmo critério do Dashboard (contratos vigentes hoje). */
export async function calcularMrr(supabase: Supa, hoje = hojeLocal()) {
  const base = await carregarBaseParcelas(supabase);
  const contratos = montarContratosDaBase(base, hoje);
  const vigentes = contratos.filter((c) => c.ativo && !!c.inicio && c.inicio <= hoje && !!c.fim && c.fim >= hoje);
  return { mrr: soma(vigentes, mrrDoContrato), contratos: vigentes.length };
}

/** Saúde dos dados: sincronização, detalhes pendentes, lançamentos sem categoria. */
export function calcularSaude(base: BaseControladoria, hoje = hojeLocal()) {
  const recentes = base.lancamentos.filter((l) => l.detalhado_em && l.vencimento >= somarDias(hoje, -365) && l.vencimento <= hoje);
  const semCategoria = recentes.filter((l) => !l.categoria_id);
  return {
    ultimaExecucao: base.ultimaExecucao,
    pendentesDetalhe: base.pendentesDetalhe,
    semCategoria,
    pctCategorizado: recentes.length ? 1 - semCategoria.length / recentes.length : null,
  };
}

/** Tela Contas a pagar: em aberto, histórico por grupo × mês e maiores fornecedores. */
export function calcularContasAPagar(base: BaseControladoria, hoje = hojeLocal()) {
  const pagar = base.lancamentos.filter((l) => l.tipo === "pagar");
  const abertos = pagar.filter((l) => emAberto(l.situacao)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const mesAtual = hoje.slice(0, 7);
  const meses = Array.from({ length: 6 }, (_, i) => deslocarMes(mesAtual, i - 5));
  const grupos = new Map<string, number[]>();
  for (const l of pagar) {
    const i = meses.indexOf(l.vencimento.slice(0, 7));
    if (i < 0) continue;
    const g = l.categoria?.raiz ?? "(sem categoria)";
    const linha = grupos.get(g) ?? meses.map(() => 0);
    linha[i] += l.valor;
    grupos.set(g, linha);
  }
  const desde12m = somarDias(hoje, -365);
  const porFornecedor = new Map<string, { nome: string; total: number; qtd: number; categorias: Set<string> }>();
  for (const l of pagar.filter((l) => l.vencimento >= desde12m && l.vencimento <= hoje)) {
    const chave = String(l.contato_id ?? l.nome);
    const f = porFornecedor.get(chave) ?? { nome: l.nome, total: 0, qtd: 0, categorias: new Set<string>() };
    f.total += l.valor;
    f.qtd++;
    if (l.categoria) f.categorias.add(l.categoria.caminho);
    porFornecedor.set(chave, f);
  }
  return {
    vencidos: abertos.filter((l) => l.vencimento < hoje),
    proximos7: abertos.filter((l) => l.vencimento >= hoje && l.vencimento <= somarDias(hoje, 6)),
    depois: abertos.filter((l) => l.vencimento > somarDias(hoje, 6)),
    meses,
    grupos: [...grupos.entries()].map(([grupo, valores]) => ({ grupo, valores, total: soma(valores, (v) => v) })).sort((a, b) => b.total - a.total),
    fornecedores: [...porFornecedor.values()]
      .map((f) => ({ ...f, categorias: [...f.categorias] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15),
  };
}

// Sincronização do financeiro inteiro da Footure no Bling para o cache da
// Controladoria (0061). Roda dentro da trava de bling_sync_execucoes (etapa
// "controladoria", ver blingSincronizacao.ts) porque usa o mesmo token e o
// mesmo limite de 3 req/s.
//
// 1. Cadastros: categorias, contas financeiras e formas de pagamento.
// 2. Listagens completas de contas a pagar e a receber (~80 chamadas). A de
//    receber só devolve o que foi emitido no último ano sem filtro — vai por
//    janelas de 1 ano de emissão desde 2020 (mesmo cuidado de bling.ts).
// 3. Detalhe (categoria, conta financeira, histórico, recorrência) só do que é
//    novo ou mudou, em aberto primeiro, até o prazo da execução. A carga
//    inicial termina em algumas execuções (o painel mostra o que falta).
// 4. Nome dos fornecedores (a listagem de contas a pagar só traz o id).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CamadaContaFinanceira, Database, FinLancamentoRow } from "@/lib/supabase/database.types";
import { consultarBling, obterAccessTokenValido } from "@/lib/integracoes/bling";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { camadaSugerida, emAberto, somarDias } from "./modelo";

type Supa = SupabaseClient<Database>;

/** Tempo para listagens + detalhes; o restante dos 300 s da função fica para alertas e e-mail. */
const PRAZO_PADRAO_MS = 150_000;
/** Detalhes só do que ainda importa: em aberto ou com vencimento nos últimos 24 meses. */
const MESES_DETALHE = 24;
const INICIO_HISTORICO = "2020-01-01";

export interface ResultadoSincronizacaoFinanceira {
  /** Movimentos de Caixa e Bancos listados nesta rodada e detalhes pendentes deles. */
  caixas: { listados: number; removidos: number; detalhados: number; pendentes: number; historicoCompleto: boolean };
  pagar: number;
  receber: number;
  removidos: number;
  detalhados: number;
  detalhesPendentes: number;
  fornecedoresNovos: number;
}

async function listar<T>(token: string, base: string, limite = 100, maxPaginas = 400): Promise<T[]> {
  const itens: T[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const sep = base.includes("?") ? "&" : "?";
    const resp = await consultarBling<{ data?: T[] }>(token, `${base}${sep}limite=${limite}&pagina=${pagina}`);
    const lote = resp.data ?? [];
    itens.push(...lote);
    if (lote.length < limite) break;
  }
  return itens;
}

async function lerTodos<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const linhas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await consulta(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) return linhas;
  }
}

async function emLotes<T>(itens: T[], tamanho: number, fn: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    const { error } = await fn(itens.slice(i, i + tamanho));
    if (error) throw new Error(error.message);
  }
}

const assinaturaDe = (situacao: number, valor: number, vencimento: string) => `${situacao}|${Number(valor).toFixed(2)}|${vencimento}`;
const dataOuNull = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) && !d.startsWith("0000") ? d.slice(0, 10) : null);
const idOuNull = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);

async function sincronizarCadastros(supabase: Supa, token: string) {
  const agora = new Date().toISOString();

  type CategoriaBling = { id: number; idCategoriaPai?: number; descricao: string; tipo?: number };
  const categorias = await listar<CategoriaBling>(token, "/categorias/receitas-despesas");
  await emLotes(
    categorias.map((c) => ({ id: c.id, id_pai: idOuNull(c.idCategoriaPai), descricao: c.descricao ?? "", tipo: c.tipo ?? null, sincronizado_em: agora })),
    500,
    (lote) => supabase.from("fin_categorias").upsert(lote),
  );

  // Conta nova recebe a camada sugerida pelo nome; nas existentes só o nome é atualizado (a camada é da Diretoria).
  type ContaBling = { id: number; descricao: string; saldoInicial?: number };
  const contas = await listar<ContaBling>(token, "/contas-contabeis");
  const { data: existentes, error } = await supabase.from("fin_contas_financeiras").select("id");
  if (error) throw new Error(error.message);
  const conhecidas = new Set((existentes ?? []).map((c) => c.id));
  const novas = contas.filter((c) => !conhecidas.has(c.id));
  if (novas.length) {
    const linhas = novas.map((c) => ({
      id: c.id,
      descricao: (c.descricao ?? "").trim(),
      camada: camadaSugerida(c.descricao ?? "") as CamadaContaFinanceira,
      saldo_inicial: c.saldoInicial ?? null,
      sincronizado_em: agora,
    }));
    const { error: erroInsert } = await supabase.from("fin_contas_financeiras").insert(linhas);
    if (erroInsert) throw new Error(erroInsert.message);
  }
  const antigas = contas.filter((c) => conhecidas.has(c.id));
  if (antigas.length) {
    await emLotes(
      antigas.map((c) => ({ id: c.id, descricao: (c.descricao ?? "").trim(), saldo_inicial: c.saldoInicial ?? null, sincronizado_em: agora })),
      500,
      (lote) => supabase.from("fin_contas_financeiras").upsert(lote),
    );
  }

  type FormaBling = { id: number; descricao: string; tipoPagamento?: number };
  const formas = await listar<FormaBling>(token, "/formas-pagamentos");
  await emLotes(
    formas.map((f) => ({ id: f.id, descricao: f.descricao ?? "", tipo_pagamento: f.tipoPagamento ?? null, sincronizado_em: agora })),
    500,
    (lote) => supabase.from("fin_formas_pagamento").upsert(lote),
  );
}

type ContaListada = {
  id: number;
  situacao: number;
  vencimento: string;
  valor: number;
  dataEmissao?: string;
  contato?: { id?: number; nome?: string };
  formaPagamento?: { id?: number };
  contaContabil?: { id?: number };
  origem?: { tipoOrigem?: string; numero?: string };
  linkBoleto?: string;
  linkQRCodePix?: string;
};

type LinhaListagem = Pick<FinLancamentoRow, "id" | "tipo" | "situacao" | "vencimento" | "valor" | "assinatura" | "sincronizado_em"> &
  Partial<Pick<FinLancamentoRow, "data_emissao" | "contato_id" | "contato_nome" | "forma_pagamento_id" | "conta_financeira_id" | "origem_tipo" | "origem_numero" | "tem_cobranca">>;

function linhaDaListagem(tipo: "pagar" | "receber", c: ContaListada, agora: string): LinhaListagem {
  const base = {
    id: c.id,
    tipo,
    situacao: c.situacao,
    vencimento: c.vencimento,
    valor: Number(c.valor) || 0,
    assinatura: assinaturaDe(c.situacao, c.valor, c.vencimento),
    contato_id: idOuNull(c.contato?.id),
    forma_pagamento_id: idOuNull(c.formaPagamento?.id),
    sincronizado_em: agora,
  };
  if (tipo === "pagar") return base;
  return {
    ...base,
    data_emissao: dataOuNull(c.dataEmissao),
    contato_nome: c.contato?.nome?.trim() || null,
    conta_financeira_id: idOuNull(c.contaContabil?.id),
    origem_tipo: c.origem?.tipoOrigem || null,
    origem_numero: c.origem?.numero || null,
    tem_cobranca: !!(c.linkBoleto || c.linkQRCodePix),
  };
}

async function listarContasReceber(token: string, hoje: string) {
  const porId = new Map<number, ContaListada>();
  for (let inicio = INICIO_HISTORICO; inicio <= hoje; inicio = somarDias(inicio, 366)) {
    const fim = somarDias(inicio, 365) < hoje ? somarDias(inicio, 365) : hoje;
    for (const c of await listar<ContaListada>(token, `/contas/receber?tipoFiltroData=E&dataInicial=${inicio}&dataFinal=${fim}`)) porId.set(c.id, c);
  }
  return [...porId.values()];
}

type ContaDetalhe = ContaListada & {
  saldo?: number;
  competencia?: string;
  historico?: string;
  portador?: { id?: number };
  categoria?: { id?: number };
  ocorrencia?: { tipo?: number };
};

export async function sincronizarFinanceiroBling(supabase: Supa, opcoes: { prazoMs?: number } = {}): Promise<ResultadoSincronizacaoFinanceira> {
  const inicio = Date.now();
  const prazo = inicio + (opcoes.prazoMs ?? PRAZO_PADRAO_MS);
  const token = await obterAccessTokenValido(supabase);
  const hoje = hojeLocal();
  const agora = new Date().toISOString();

  await sincronizarCadastros(supabase, token);

  const [pagar, receber] = [await listar<ContaListada>(token, "/contas/pagar"), await listarContasReceber(token, hoje)];
  const linhas = [...pagar.map((c) => linhaDaListagem("pagar", c, agora)), ...receber.map((c) => linhaDaListagem("receber", c, agora))];
  // Contas a pagar e a receber têm ids distintos no Bling; a listagem pode repetir item entre páginas.
  const unicas = [...new Map(linhas.map((l) => [l.id, l])).values()];
  await emLotes(unicas.filter((l) => l.tipo === "pagar"), 500, (lote) => supabase.from("fin_lancamentos").upsert(lote));
  await emLotes(unicas.filter((l) => l.tipo === "receber"), 500, (lote) => supabase.from("fin_lancamentos").upsert(lote));

  // O que sumiu do Bling (excluído lá) sai do cache.
  const cache = await lerTodos((de, ate) =>
    supabase.from("fin_lancamentos").select("id, tipo, situacao, vencimento, assinatura, assinatura_detalhe, detalhado_em, contato_id").order("id").range(de, ate),
  );
  const vigentes = new Set(unicas.map((l) => l.id));
  const removidos = cache.filter((l) => !vigentes.has(l.id)).map((l) => l.id);
  await emLotes(removidos, 200, (lote) => supabase.from("fin_lancamentos").delete().in("id", lote));

  // Detalhes: novo ou alterado desde o último detalhe; em aberto primeiro, depois do mais recente ao mais antigo.
  const limiteHistorico = somarDias(hoje, -MESES_DETALHE * 31);
  const atual = new Map(unicas.map((l) => [l.id, l]));
  const pendentes = cache
    .filter((l) => vigentes.has(l.id))
    .map((l) => ({ ...l, ...atual.get(l.id)! }))
    .filter((l) => (!l.detalhado_em || l.assinatura_detalhe !== l.assinatura) && (emAberto(l.situacao) || l.vencimento >= limiteHistorico))
    .sort((a, b) => Number(emAberto(b.situacao)) - Number(emAberto(a.situacao)) || b.vencimento.localeCompare(a.vencimento));

  let detalhados = 0;
  for (let i = 0; i < pendentes.length && Date.now() < prazo; i += 6) {
    const lote = pendentes.slice(i, i + 6);
    await Promise.all(
      lote.map(async (l) => {
        const d = (await consultarBling<{ data: ContaDetalhe }>(token, `/contas/${l.tipo}/${l.id}`)).data;
        const { error } = await supabase
          .from("fin_lancamentos")
          .update({
            saldo: d.saldo ?? null,
            data_emissao: dataOuNull(d.dataEmissao),
            competencia: dataOuNull(d.competencia),
            contato_id: idOuNull(d.contato?.id) ?? l.contato_id,
            categoria_id: idOuNull(d.categoria?.id),
            conta_financeira_id: idOuNull(d.portador?.id) ?? idOuNull(d.contaContabil?.id),
            forma_pagamento_id: idOuNull(d.formaPagamento?.id),
            ocorrencia_tipo: d.ocorrencia?.tipo ?? null,
            historico: d.historico?.trim().slice(0, 500) || null,
            assinatura_detalhe: l.assinatura,
            detalhado_em: new Date().toISOString(),
          })
          .eq("id", l.id);
        if (error) throw new Error(error.message);
        detalhados++;
      }),
    );
  }

  // Fornecedores: a listagem de contas a pagar só traz o id do contato.
  let fornecedoresNovos = 0;
  if (Date.now() < prazo) {
    const { data: conhecidos } = await supabase.from("fin_contatos").select("id");
    const jaTem = new Set((conhecidos ?? []).map((c) => c.id));
    const faltam = [...new Set(pagar.filter((c) => c.vencimento >= limiteHistorico || emAberto(c.situacao)).map((c) => idOuNull(c.contato?.id)))].filter(
      (id): id is number => !!id && !jaTem.has(id),
    );
    for (let i = 0; i < faltam.length && Date.now() < prazo; i += 6) {
      const lote = faltam.slice(i, i + 6);
      const nomes = await Promise.all(
        lote.map(async (id) => {
          const c = (await consultarBling<{ data: { nome?: string; fantasia?: string } }>(token, `/contatos/${id}`)).data;
          return { id, nome: (c.fantasia?.trim() || c.nome?.trim() || `Contato ${id}`).slice(0, 200), sincronizado_em: agora };
        }),
      );
      const { error } = await supabase.from("fin_contatos").upsert(nomes);
      if (error) throw new Error(error.message);
      fornecedoresNovos += nomes.length;
    }
  }

  return {
    pagar: pagar.length,
    receber: receber.length,
    removidos: removidos.length,
    detalhados,
    detalhesPendentes: pendentes.length - detalhados,
    fornecedoresNovos,
    caixas: await sincronizarCaixas(supabase, token, hoje, prazo),
  };
}

// ─── Caixa e Bancos (/caixas, 0065) ──────────────────────────────────────────
/** Primeiro mês com movimento de caixa na conta da Footure (histórico completo na carga inicial). */
const INICIO_CAIXAS = "2020-12";
/** Rodadas normais relistam só os meses recentes (onde baixas e lançamentos ainda mudam). */
const MESES_RELISTADOS = 3;

type CaixaListado = { id: number; data: string; debCred: string; valor: number; situacao?: string; contaFinanceira?: { id?: number } };
type CaixaDetalhe = {
  competencia?: string;
  categoria?: { id?: number };
  transferencia?: string;
  tipoLancamento?: string | number;
  origem?: { id?: number; tipo?: string };
};

/** O detalhe de /caixas devolve datas como dd/mm/aaaa; a listagem, ISO. */
function dataBling(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const br = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return dataOuNull(d);
}

/** /caixas corta em 50 por página mesmo pedindo 100: segue até a página vazia. */
async function listarCaixasDoMes(token: string, mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const itens: CaixaListado[] = [];
  for (let pagina = 1; pagina <= 60; pagina++) {
    const resp = await consultarBling<{ data?: CaixaListado[] }>(token, `/caixas?dataInicial=${mes}-01&dataFinal=${fim}&limite=100&pagina=${pagina}`);
    const lote = resp.data ?? [];
    if (!lote.length) break;
    itens.push(...lote);
  }
  return itens;
}

async function sincronizarCaixas(supabase: Supa, token: string, hoje: string, prazo: number) {
  const { count } = await supabase.from("fin_caixa_movimentos").select("id", { count: "exact", head: true });
  const historicoCompleto = !count;
  const mesAtual = hoje.slice(0, 7);
  const meses: string[] = [];
  const primeiro = historicoCompleto ? INICIO_CAIXAS : deslocar(mesAtual, -(MESES_RELISTADOS - 1));
  for (let mes = primeiro; mes <= mesAtual; mes = deslocar(mes, 1)) meses.push(mes);

  const agora = new Date().toISOString();
  const listados: CaixaListado[] = [];
  for (const mes of meses) listados.push(...(await listarCaixasDoMes(token, mes)));
  const unicos = [...new Map(listados.map((c) => [c.id, c])).values()];
  const linhas = unicos
    .map((c) => {
      const data = dataBling(c.data);
      const dc = c.debCred === "C" || c.debCred === "D" ? c.debCred : "S";
      const valor = Math.abs(Number(c.valor) || 0);
      const conta = idOuNull(c.contaFinanceira?.id);
      return data
        ? { id: c.id, data, debito_credito: dc as "C" | "D" | "S", valor, situacao: c.situacao ?? null, conta_financeira_id: conta, assinatura: `${data}|${dc}|${valor.toFixed(2)}|${conta ?? ""}`, sincronizado_em: agora }
        : null;
    })
    .filter((l): l is NonNullable<typeof l> => !!l);
  await emLotes(linhas, 500, (lote) => supabase.from("fin_caixa_movimentos").upsert(lote));

  // Excluídos no Bling: só dentro dos meses relistados.
  const vistos = new Set(linhas.map((l) => l.id));
  const noPeriodo = await lerTodos((de, ate) =>
    supabase.from("fin_caixa_movimentos").select("id").gte("data", `${meses[0]}-01`).order("id").range(de, ate),
  );
  const removidos = noPeriodo.map((l) => l.id).filter((id) => !vistos.has(id));
  await emLotes(removidos, 200, (lote) => supabase.from("fin_caixa_movimentos").delete().in("id", lote));

  // Detalhe (categoria, competência, origem, transferência): novos/alterados dos últimos 24 meses, do mais recente.
  const limite = somarDias(hoje, -MESES_DETALHE * 31);
  const pendentes = (
    await lerTodos((de, ate) =>
      supabase.from("fin_caixa_movimentos").select("id, assinatura, assinatura_detalhe, detalhado_em, data").gte("data", limite).order("id").range(de, ate),
    )
  )
    .filter((m) => !m.detalhado_em || m.assinatura_detalhe !== m.assinatura)
    .sort((a, b) => b.data.localeCompare(a.data));
  let detalhados = 0;
  for (let i = 0; i < pendentes.length && Date.now() < prazo; i += 6) {
    await Promise.all(
      pendentes.slice(i, i + 6).map(async (m) => {
        const d = (await consultarBling<{ data: CaixaDetalhe }>(token, `/caixas/${m.id}`)).data;
        const { error } = await supabase
          .from("fin_caixa_movimentos")
          .update({
            competencia: dataBling(d.competencia),
            categoria_id: idOuNull(d.categoria?.id),
            transferencia: d.transferencia === "S",
            tipo_lancamento: d.tipoLancamento == null ? null : String(d.tipoLancamento),
            origem_tipo: d.origem?.tipo || null,
            origem_id: idOuNull(d.origem?.id),
            assinatura_detalhe: m.assinatura,
            detalhado_em: new Date().toISOString(),
          })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
        detalhados++;
      }),
    );
  }
  return { listados: linhas.length, removidos: removidos.length, detalhados, pendentes: pendentes.length - detalhados, historicoCompleto };
}

function deslocar(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

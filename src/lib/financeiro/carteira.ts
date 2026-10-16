// Financeiro (Contratos e Pagamentos), Inadimplência e Dashboard: tudo
// calculado a partir do cache do Bling (bling_contatos, bling_pedidos,
// bling_parcelas — gravados na sincronização), nenhuma chamada ao Bling ao
// vivo. "Contrato" = pedido de venda do Bling; as parcelas se ligam a ele por
// (contato, número do pedido de origem).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { classificarSituacaoParcela, pedidoBlingCancelado, type SituacaoParcela } from "@/lib/integracoes/bling";
import { mesesEntre } from "@/lib/formatacao";

type Supa = SupabaseClient<Database>;

export interface ParcelaCarteira {
  id: number;
  contatoId: number;
  numeroPedidoOrigem: string | null;
  vencimento: string;
  valor: number;
  situacao: SituacaoParcela;
  /** Posição da parcela dentro do pedido de origem no Bling (ordem de vencimento). */
  numero: number;
  totalDoPedido: number;
  /** Data da baixa (pagamento) — vem do borderô do Bling (0032); nulo até a sincronização buscar o detalhe. */
  dataPagamento: string | null;
  valorPago: number | null;
}

export function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const linhas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await consulta(pagina * 1000, pagina * 1000 + 999);
    if (error) {
      console.error("[financeiro/carteira]", error.message);
      break;
    }
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/** CNPJs que não são clientes: a própria Footure aparece no Bling ("Footure FC")
 * com pedidos de TESTE — fica fora de vendas, contratos, receita e inadimplência. */
const CNPJS_FORA_DA_CARTEIRA = new Set(["32527841000148"]);

/** Base comum (Financeiro, Inadimplência, Dashboard e Vendas): parcelas do cache já
 * classificadas e numeradas n/N, e o nome/logo/cadastro local de cada contato do Bling. */
export async function carregarBaseParcelas(supabase: Supa) {
  const [parcelasTodas, pedidosTodos, contatosTodos, clientesLocais, vigencias] = await Promise.all([
    lerTudo((de, ate) => supabase.from("bling_parcelas").select("*").order("vencimento").range(de, ate)),
    lerTudo((de, ate) => supabase.from("bling_pedidos").select("*").range(de, ate)),
    lerTudo((de, ate) => supabase.from("bling_contatos").select("id, nome, cnpj, sincronizado_em").range(de, ate)),
    lerTudo((de, ate) =>
      supabase.from("clientes").select("id, razao_social, nome_fantasia, logo_path, tipo, bling_contato_id").not("bling_contato_id", "is", null).range(de, ate),
    ),
    lerTudo((de, ate) => supabase.from("contrato_vigencia_bling").select("bling_pedido_id, vigencia_inicio, vigencia_fim").range(de, ate)),
  ]);
  const foraDaCarteira = new Set(contatosTodos.filter((c) => CNPJS_FORA_DA_CARTEIRA.has(c.cnpj)).map((c) => c.id));
  const contatos = contatosTodos.filter((c) => !foraDaCarteira.has(c.id));
  const pedidos = pedidosTodos.filter((p) => !foraDaCarteira.has(p.contato_id));
  const parcelasBrutas = parcelasTodas.filter((p) => !foraDaCarteira.has(p.contato_id));
  const vigenciaPorPedido = new Map<number, VigenciaContrato>(vigencias.map((v) => [v.bling_pedido_id, { inicio: v.vigencia_inicio, fim: v.vigencia_fim }]));

  const clientePorContato = new Map(clientesLocais.map((c) => [c.bling_contato_id!, c]));
  const contatoPorId = new Map(contatos.map((c) => [c.id, c]));

  // Numeração n/N dentro de cada pedido de origem (o Bling não devolve pronta).
  const grupos = new Map<string, typeof parcelasBrutas>();
  for (const p of parcelasBrutas) {
    const chave = `${p.contato_id}:${p.numero_pedido_origem ?? "avulsa"}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  const parcelas: ParcelaCarteira[] = [];
  for (const grupo of grupos.values()) {
    grupo.forEach((p, i) =>
      parcelas.push({
        id: p.id,
        contatoId: p.contato_id,
        numeroPedidoOrigem: p.numero_pedido_origem,
        vencimento: p.vencimento,
        valor: Number(p.valor),
        situacao: classificarSituacaoParcela(p.situacao, p.vencimento),
        numero: i + 1,
        totalDoPedido: grupo.length,
        dataPagamento: p.data_pagamento,
        valorPago: p.valor_pago === null ? null : Number(p.valor_pago),
      }),
    );
  }

  const nomeDoContato = (id: number) => {
    const local = clientePorContato.get(id);
    return local?.nome_fantasia || local?.razao_social || contatoPorId.get(id)?.nome || "Cliente";
  };
  const sincronizadoEm = contatos.reduce<string | null>((max, c) => (!max || c.sincronizado_em > max ? c.sincronizado_em : max), null);

  const pedidoPorChave = new Map(pedidos.map((p) => [chavePedido(p.contato_id, p.numero), p]));
  /** Parcela de pedido cancelado no Bling — fica fora de Contratos e Pagamentos. */
  const deCancelado = (p: ParcelaCarteira) => {
    const pedido = p.numeroPedidoOrigem ? pedidoPorChave.get(chavePedido(p.contatoId, p.numeroPedidoOrigem)) : undefined;
    return !!pedido && pedidoBlingCancelado(pedido.situacao_id, pedido.situacao_valor);
  };

  return { parcelas, pedidos, pedidoPorChave, deCancelado, clientePorContato, nomeDoContato, vigenciaPorPedido, sincronizadoEm, temCache: parcelasBrutas.length > 0 };
}

function chavePedido(contatoId: number, numero: string) {
  return `${contatoId}:${numero}`;
}

const soma = (lista: { valor: number }[]) => lista.reduce((s, p) => s + p.valor, 0);
/** "A executar / a receber" = ainda tem saldo: em aberto, atrasada ou paga só em parte. */
const emAberto = (p: ParcelaCarteira) => p.situacao === "em_aberto" || p.situacao === "atrasada" || p.situacao === "recebida_parcial";

// ---------------------------------------------------------------- Contratos

export type SituacaoContrato = "em_dia" | "atrasado" | "concluido" | "cancelado";
export type FiltroContratos = "ativos" | "vencem_3_meses" | "inativos" | "cancelados";

export interface ContratoFinanceiro {
  pedidoId: number;
  numeroPedido: string;
  contatoId: number;
  clienteId: string | null;
  cliente: string;
  logoPath: string | null;
  /** Início/fim da vigência informada na plataforma (0034); sem ela, data da venda e vencimento da última parcela. */
  inicio: string | null;
  fim: string | null;
  /** Vigência informada na plataforma — o Bling não tem esse dado. */
  vigenciaDefinida: boolean;
  /** Data do pedido de venda no Bling (independe da vigência). */
  dataVenda: string | null;
  valorTotal: number;
  pagas: number;
  totalParcelas: number;
  proximoVencimento: string | null;
  situacao: SituacaoContrato;
  ativo: boolean;
  venceEm3Meses: boolean;
}

/** aaaa-mm-dd + N meses (dia preservado, sem fuso). */
function somarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(a, m - 1 + meses, d);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

type PedidoBlingCache = Database["public"]["Tables"]["bling_pedidos"]["Row"];
export interface VigenciaContrato {
  inicio: string;
  fim: string;
}

/**
 * Situação de um contrato (pedido de venda do Bling) — usado na lista e no
 * detalhe. Ativo = não cancelado e com a vigência cobrindo hoje: a definida
 * na plataforma (0034) ou, sem ela, a estimada (data da venda até o último
 * vencimento). Parcela atrasada não mantém o contrato ativo — ele aparece
 * como "Atrasado" entre os inativos (é inadimplência, não contrato em vigor).
 */
function montarContrato(
  pedido: PedidoBlingCache,
  parcelas: ParcelaCarteira[],
  ctx: { clienteId: string | null; cliente: string; logoPath: string | null; hoje: string; em3Meses: string; vigencia: VigenciaContrato | null },
): ContratoFinanceiro {
  const cancelado = pedidoBlingCancelado(pedido.situacao_id, pedido.situacao_valor);
  const fim = ctx.vigencia?.fim ?? (parcelas.length ? parcelas[parcelas.length - 1].vencimento : pedido.data);
  const ativo = !cancelado && !!fim && fim >= ctx.hoje;
  return {
    pedidoId: pedido.id,
    numeroPedido: pedido.numero,
    contatoId: pedido.contato_id,
    clienteId: ctx.clienteId,
    cliente: ctx.cliente,
    logoPath: ctx.logoPath,
    inicio: ctx.vigencia?.inicio ?? pedido.data,
    fim,
    vigenciaDefinida: !!ctx.vigencia,
    dataVenda: pedido.data,
    valorTotal: Number(pedido.total) || soma(parcelas),
    pagas: parcelas.filter((p) => p.situacao === "recebida").length,
    totalParcelas: parcelas.length,
    proximoVencimento: parcelas.find((p) => p.situacao === "em_aberto")?.vencimento ?? null,
    situacao: cancelado ? "cancelado" : parcelas.some((p) => p.situacao === "atrasada") ? "atrasado" : ativo ? "em_dia" : "concluido",
    ativo,
    // Termina nos próximos 3 meses (renovação): ativo e fim (vigência ou última parcela) entre hoje e hoje + 3 meses.
    venceEm3Meses: ativo && !!fim && fim >= ctx.hoje && fim <= ctx.em3Meses,
  };
}

/** Todos os contratos (pedidos de venda do Bling) da base já carregada — Financeiro · Contratos e Dashboard. */
export function montarContratosDaBase(base: Awaited<ReturnType<typeof carregarBaseParcelas>>, hoje = hojeLocal()): ContratoFinanceiro[] {
  const em3Meses = somarMeses(hoje, 3);
  const parcelasPorPedido = new Map<string, ParcelaCarteira[]>();
  for (const p of base.parcelas) {
    if (!p.numeroPedidoOrigem) continue;
    const k = chavePedido(p.contatoId, p.numeroPedidoOrigem);
    parcelasPorPedido.set(k, [...(parcelasPorPedido.get(k) ?? []), p]);
  }
  return base.pedidos.map((pedido) => {
    const local = base.clientePorContato.get(pedido.contato_id);
    return montarContrato(pedido, parcelasPorPedido.get(chavePedido(pedido.contato_id, pedido.numero)) ?? [], {
      clienteId: local?.id ?? null,
      cliente: base.nomeDoContato(pedido.contato_id),
      logoPath: local?.logo_path ?? null,
      hoje,
      em3Meses,
      vigencia: base.vigenciaPorPedido.get(pedido.id) ?? null,
    });
  });
}

export async function carregarContratos(supabase: Supa) {
  const base = await carregarBaseParcelas(supabase);
  const hoje = hojeLocal();
  const ano = hoje.slice(0, 4);

  const contratos = montarContratosDaBase(base, hoje);
  contratos.sort((a, b) => Number(b.situacao === "atrasado") - Number(a.situacao === "atrasado") || (a.fim ?? "").localeCompare(b.fim ?? ""));

  // KPIs do ano corrente — regra de produto: parcelas que VENCEM no ano (pagas ou não), como em Pagamentos.
  const parcelasDoAno = base.parcelas.filter((p) => p.numeroPedidoOrigem && p.vencimento.startsWith(ano) && !base.deCancelado(p));
  const resumo = {
    ano,
    totalContratado: contratos.filter((c) => c.situacao !== "cancelado" && c.inicio?.startsWith(ano)).reduce((s, c) => s + c.valorTotal, 0),
    contratosNoAno: contratos.filter((c) => c.situacao !== "cancelado" && c.inicio?.startsWith(ano)).length,
    paraExecucao: soma(parcelasDoAno),
    executado: soma(parcelasDoAno.filter((p) => p.situacao === "recebida")),
    aExecutar: soma(parcelasDoAno.filter(emAberto)),
  };

  return { contratos, resumo, sincronizadoEm: base.sincronizadoEm, temCache: base.temCache };
}

/**
 * Um contrato (pedido de venda do Bling, pelo id) para a tela de detalhe: o
 * pedido do cache, as parcelas numeradas n/N, o cliente (cadastro local, se
 * houver, ou o contato do cache) e os arquivos anexados (0033). Só lê o que é
 * desse pedido — não carrega a carteira inteira.
 */
export async function carregarContrato(supabase: Supa, blingPedidoId: number) {
  const { data: pedido } = await supabase.from("bling_pedidos").select("*").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return null;

  const [{ data: brutas }, { data: contato }, { data: clienteLocal }, { data: arquivos }, { data: vigencia }] = await Promise.all([
    supabase.from("bling_parcelas").select("*").eq("contato_id", pedido.contato_id).eq("numero_pedido_origem", pedido.numero).order("vencimento"),
    supabase.from("bling_contatos").select("id, nome, cnpj, sincronizado_em").eq("id", pedido.contato_id).maybeSingle(),
    supabase.from("clientes").select("*").eq("bling_contato_id", pedido.contato_id).maybeSingle(),
    supabase
      .from("contrato_arquivos_bling")
      .select("id, arquivo_path, nome_arquivo, tamanho_bytes, enviado_em, profiles(nome)")
      .eq("bling_pedido_id", blingPedidoId)
      .order("enviado_em", { ascending: false }),
    supabase.from("contrato_vigencia_bling").select("vigencia_inicio, vigencia_fim, atualizado_em, profiles(nome)").eq("bling_pedido_id", blingPedidoId).maybeSingle(),
  ]);

  const parcelas: ParcelaCarteira[] = (brutas ?? []).map((p, i, todas) => ({
    id: p.id,
    contatoId: p.contato_id,
    numeroPedidoOrigem: p.numero_pedido_origem,
    vencimento: p.vencimento,
    valor: Number(p.valor),
    situacao: classificarSituacaoParcela(p.situacao, p.vencimento),
    numero: i + 1,
    totalDoPedido: todas.length,
    dataPagamento: p.data_pagamento,
    valorPago: p.valor_pago === null ? null : Number(p.valor_pago),
  }));

  const hoje = hojeLocal();
  const contrato = montarContrato(pedido, parcelas, {
    clienteId: clienteLocal?.id ?? null,
    cliente: clienteLocal?.nome_fantasia || clienteLocal?.razao_social || contato?.nome || "Cliente",
    logoPath: clienteLocal?.logo_path ?? null,
    hoje,
    em3Meses: somarMeses(hoje, 3),
    vigencia: vigencia ? { inicio: vigencia.vigencia_inicio, fim: vigencia.vigencia_fim } : null,
  });

  return {
    pedido,
    contrato,
    parcelas,
    contato: contato ?? null,
    clienteLocal: clienteLocal ?? null,
    vigencia: vigencia
      ? { atualizadoEm: vigencia.atualizado_em, atualizadoPor: (vigencia.profiles as unknown as { nome: string } | null)?.nome ?? null }
      : null,
    arquivos: (arquivos ?? []).map((a) => ({ ...a, enviadoPor: (a.profiles as unknown as { nome: string } | null)?.nome ?? null })),
    resumo: {
      pago: parcelas.reduce((s, p) => s + (p.situacao === "recebida" ? (p.valorPago ?? p.valor) : p.situacao === "recebida_parcial" ? (p.valorPago ?? 0) : 0), 0),
      emAberto: soma(parcelas.filter((p) => p.situacao === "em_aberto")),
      vencido: soma(parcelas.filter((p) => p.situacao === "atrasada")),
    },
    sincronizadoEm: contato?.sincronizado_em ?? null,
  };
}

/**
 * Valor mensal (MRR) de um contrato: com vigência definida na plataforma,
 * valor ÷ meses de vigência. Sem ela, valor ÷ max(12, nº de parcelas) — 12
 * meses é o prazo padrão; dividir só pelas parcelas fazia um contrato à vista
 * (1 parcela) entrar com o valor inteiro como se fosse mensal. Usado no
 * Dashboard e em Vendas.
 */
export function mrrDoContrato(c: Pick<ContratoFinanceiro, "valorTotal" | "vigenciaDefinida" | "inicio" | "fim" | "totalParcelas">) {
  const meses = c.vigenciaDefinida && c.inicio && c.fim ? (mesesEntre(c.inicio, c.fim) ?? 12) : Math.max(12, c.totalParcelas);
  return c.valorTotal / meses;
}

export function contratoNoFiltro(c: ContratoFinanceiro, filtro: FiltroContratos) {
  if (filtro === "ativos") return c.ativo;
  if (filtro === "vencem_3_meses") return c.venceEm3Meses;
  if (filtro === "inativos") return !c.ativo && c.situacao !== "cancelado";
  return c.situacao === "cancelado";
}

// --------------------------------------------------------------- Pagamentos

export type StatusPagamento = "em_aberto" | "atrasada" | "paga";

/** Filtro de status da tela Pagamentos — "paga parcial" ainda tem saldo, então entra em "em aberto". */
export function statusPagamento(p: ParcelaCarteira): StatusPagamento {
  if (p.situacao === "recebida") return "paga";
  if (p.situacao === "atrasada") return "atrasada";
  return "em_aberto";
}

/** `mes` = "aaaa-mm". Parcelas com vencimento no mês, fora as de pedido cancelado. */
export async function carregarPagamentos(supabase: Supa, mes: string) {
  const base = await carregarBaseParcelas(supabase);
  const doMes = base.parcelas
    .filter((p) => p.vencimento.startsWith(mes) && !base.deCancelado(p))
    .map((p) => ({
      ...p,
      cliente: base.nomeDoContato(p.contatoId),
      clienteId: base.clientePorContato.get(p.contatoId)?.id ?? null,
      /** Pedido de venda (contrato) de origem — destino do clique na lista; nulo para parcela avulsa. */
      contratoId: p.numeroPedidoOrigem ? (base.pedidoPorChave.get(chavePedido(p.contatoId, p.numeroPedidoOrigem))?.id ?? null) : null,
      status: statusPagamento(p),
    }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.cliente.localeCompare(b.cliente));

  // Previsto = recebido + a receber + vencido (cada parcela cai em exatamente um).
  const resumo = {
    previsto: soma(doMes),
    recebido: soma(doMes.filter((p) => p.status === "paga")),
    aReceber: soma(doMes.filter((p) => p.status === "em_aberto")),
    vencido: soma(doMes.filter((p) => p.status === "atrasada")),
    quantidade: doMes.length,
  };

  return { parcelas: doMes, resumo, sincronizadoEm: base.sincronizadoEm, temCache: base.temCache };
}


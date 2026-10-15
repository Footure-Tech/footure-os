// Financeiro (Contratos e Pagamentos), Inadimplência e Dashboard: tudo
// calculado a partir do cache do Bling (bling_contatos, bling_pedidos,
// bling_parcelas — gravados na sincronização), nenhuma chamada ao Bling ao
// vivo. "Contrato" = pedido de venda do Bling; as parcelas se ligam a ele por
// (contato, número do pedido de origem).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { classificarSituacaoParcela, pedidoBlingCancelado, type SituacaoParcela } from "@/lib/integracoes/bling";

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

/** Base comum (Financeiro e Inadimplência): parcelas do cache já classificadas
 * e numeradas n/N, e o nome/logo/cadastro local de cada contato do Bling. */
export async function carregarBaseParcelas(supabase: Supa) {
  const [parcelasBrutas, pedidos, contatos, clientesLocais] = await Promise.all([
    lerTudo((de, ate) => supabase.from("bling_parcelas").select("*").order("vencimento").range(de, ate)),
    lerTudo((de, ate) => supabase.from("bling_pedidos").select("*").range(de, ate)),
    lerTudo((de, ate) => supabase.from("bling_contatos").select("id, nome, sincronizado_em").range(de, ate)),
    lerTudo((de, ate) =>
      supabase.from("clientes").select("id, razao_social, nome_fantasia, logo_path, bling_contato_id").not("bling_contato_id", "is", null).range(de, ate),
    ),
  ]);

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

  return { parcelas, pedidos, pedidoPorChave, deCancelado, clientePorContato, nomeDoContato, sincronizadoEm, temCache: parcelasBrutas.length > 0 };
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
  inicio: string | null;
  /** Fim = vencimento da última parcela (a vigência formal fica no pedido local, ainda sem vínculo). */
  fim: string | null;
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

export async function carregarContratos(supabase: Supa) {
  const base = await carregarBaseParcelas(supabase);
  const hoje = hojeLocal();
  const em3Meses = somarMeses(hoje, 3);
  const ano = hoje.slice(0, 4);

  const parcelasPorPedido = new Map<string, ParcelaCarteira[]>();
  for (const p of base.parcelas) {
    if (!p.numeroPedidoOrigem) continue;
    const k = chavePedido(p.contatoId, p.numeroPedidoOrigem);
    parcelasPorPedido.set(k, [...(parcelasPorPedido.get(k) ?? []), p]);
  }

  const contratos: ContratoFinanceiro[] = base.pedidos.map((pedido) => {
    const parcelas = parcelasPorPedido.get(chavePedido(pedido.contato_id, pedido.numero)) ?? [];
    const cancelado = pedidoBlingCancelado(pedido.situacao_id, pedido.situacao_valor);
    const ativo = !cancelado && parcelas.some(emAberto);
    const fim = parcelas.length ? parcelas[parcelas.length - 1].vencimento : pedido.data;
    const local = base.clientePorContato.get(pedido.contato_id);
    return {
      pedidoId: pedido.id,
      numeroPedido: pedido.numero,
      contatoId: pedido.contato_id,
      clienteId: local?.id ?? null,
      cliente: base.nomeDoContato(pedido.contato_id),
      logoPath: local?.logo_path ?? null,
      inicio: pedido.data,
      fim,
      valorTotal: Number(pedido.total) || soma(parcelas),
      pagas: parcelas.filter((p) => p.situacao === "recebida").length,
      totalParcelas: parcelas.length,
      proximoVencimento: parcelas.find((p) => p.situacao === "em_aberto")?.vencimento ?? null,
      situacao: cancelado ? "cancelado" : !ativo ? "concluido" : parcelas.some((p) => p.situacao === "atrasada") ? "atrasado" : "em_dia",
      ativo,
      // Termina nos próximos 3 meses (renovação à vista): ativo e última parcela entre hoje e hoje + 3 meses.
      venceEm3Meses: ativo && !!fim && fim >= hoje && fim <= em3Meses,
    };
  });
  contratos.sort((a, b) => Number(b.situacao === "atrasado") - Number(a.situacao === "atrasado") || (a.fim ?? "").localeCompare(b.fim ?? ""));

  // KPIs do ano corrente — execução por data de VENCIMENTO (o cache não tem a data da baixa).
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

export function contratoNoFiltro(c: ContratoFinanceiro, filtro: FiltroContratos) {
  if (filtro === "ativos") return c.ativo;
  if (filtro === "vencem_3_meses") return c.venceEm3Meses;
  if (filtro === "inativos") return c.situacao === "concluido";
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
    .map((p) => ({ ...p, cliente: base.nomeDoContato(p.contatoId), clienteId: base.clientePorContato.get(p.contatoId)?.id ?? null, status: statusPagamento(p) }))
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


// Comercial · Vendas: cada venda = um pedido de venda do Bling (cache da
// sincronização), fora os cancelados. Data de fechamento = data do pedido no
// Bling; primeira parcela = menor vencimento das contas a receber do pedido.
// SDR e Closer: informados na tela do contrato (0035) ou, para pedidos
// fechados pela plataforma, os do pedido — o Bling não tem esse dado.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoCliente } from "@/lib/supabase/database.types";
import { carregarBaseParcelas, hojeLocal, montarContratosDaBase, mrrDoContrato } from "@/lib/financeiro/carteira";

type Supa = SupabaseClient<Database>;

export type PeriodoVendas = "mes" | "tri" | "12m";
const MESES: Record<PeriodoVendas, number> = { mes: 1, tri: 3, "12m": 12 };

/** Primeiro dia (aaaa-mm-01) do mês deslocado `delta` meses a partir de hoje. */
function inicioDoMes(hoje: string, delta: number) {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export interface Venda {
  blingPedidoId: number;
  numeroPedido: string;
  contatoId: number;
  clienteId: string | null;
  cliente: string;
  logoPath: string | null;
  tipo: TipoCliente | null;
  dataFechamento: string;
  primeiraParcela: string | null;
  valorTotal: number;
  /** Valor mensal que a venda adiciona (mesma conta do MRR do Dashboard). */
  mrr: number;
  sdr: string | null;
  closer: string | null;
}

export async function carregarVendas(supabase: Supa) {
  const hoje = hojeLocal();
  const [base, { data: pedidosLocais, error }, { data: equipesBling, error: erroEquipe }, { data: perfis }] = await Promise.all([
    carregarBaseParcelas(supabase),
    supabase.from("pedidos").select("bling_pedido_id, sdr_id, closer_id").not("bling_pedido_id", "is", null),
    supabase.from("contrato_equipe_bling").select("bling_pedido_id, sdr_id, closer_id"),
    supabase.from("profiles").select("user_id, nome"),
  ]);
  if (error) console.error("[vendas] pedidos locais:", error.message);
  if (erroEquipe) console.error("[vendas] equipe das vendas do Bling:", erroEquipe.message);
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  const pessoa = (id: string | null) => (id ? (nome.get(id) ?? null) : null);
  // SDR/Closer: o informado na tela do contrato (0035) tem prioridade; senão, o do pedido da plataforma.
  const equipePorPedido = new Map<string, { sdr: string | null; closer: string | null }>();
  for (const p of pedidosLocais ?? []) equipePorPedido.set(p.bling_pedido_id!, { sdr: pessoa(p.sdr_id), closer: pessoa(p.closer_id) });
  for (const e of equipesBling ?? []) equipePorPedido.set(String(e.bling_pedido_id), { sdr: pessoa(e.sdr_id), closer: pessoa(e.closer_id) });

  const primeiraParcela = new Map<string, string>();
  for (const p of base.parcelas) {
    if (!p.numeroPedidoOrigem) continue;
    const chave = `${p.contatoId}:${p.numeroPedidoOrigem}`;
    const atual = primeiraParcela.get(chave);
    if (!atual || p.vencimento < atual) primeiraParcela.set(chave, p.vencimento);
  }

  const vendas: Venda[] = montarContratosDaBase(base, hoje)
    .filter((c) => c.situacao !== "cancelado" && !!c.dataVenda)
    .map((c) => {
      const equipe = equipePorPedido.get(String(c.pedidoId));
      return {
        blingPedidoId: c.pedidoId,
        numeroPedido: c.numeroPedido,
        contatoId: c.contatoId,
        clienteId: c.clienteId,
        cliente: c.cliente,
        logoPath: c.logoPath,
        tipo: base.clientePorContato.get(c.contatoId)?.tipo ?? null,
        dataFechamento: c.dataVenda!,
        primeiraParcela: primeiraParcela.get(`${c.contatoId}:${c.numeroPedido}`) ?? null,
        valorTotal: c.valorTotal,
        mrr: mrrDoContrato(c),
        sdr: equipe?.sdr ?? null,
        closer: equipe?.closer ?? null,
      };
    })
    .sort((a, b) => b.dataFechamento.localeCompare(a.dataFechamento) || Number(b.numeroPedido) - Number(a.numeroPedido));

  /** Vendas do período: mês atual, últimos 3 ou últimos 12 meses (inclui o atual), como no Dashboard. */
  const doPeriodo = (periodo: PeriodoVendas) => {
    const inicio = inicioDoMes(hoje, -(MESES[periodo] - 1));
    return vendas.filter((v) => v.dataFechamento >= inicio && v.dataFechamento <= hoje);
  };

  return { vendas, doPeriodo, sincronizadoEm: base.sincronizadoEm, temCache: base.temCache };
}

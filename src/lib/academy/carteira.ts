// Footure Academy · clientes e inadimplência: compradores dos cursos (vendas do
// cache academy_vendas) e as parcelas dos pedidos (academy_parcelas, 0046).
// Parcela vencida = em aberto com vencimento passado (classificarSituacaoParcela),
// como no Footlink; taxa = vencido ÷ tudo o que já venceu (pago ou não); faixas
// pelo atraso de cada parcela. Parcelas de pedido cancelado ou
// duplicado (contado uma vez só) ficam de fora.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { classificarSituacaoParcela, type SituacaoParcela } from "@/lib/integracoes/bling";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { FAIXAS_ATRASO } from "@/lib/inadimplencia/consultas";
import { carregarVendasAcademy, type VendaAcademy } from "./vendas";

type Supa = SupabaseClient<Database>;

export interface ParcelaAcademy {
  id: number;
  blingPedidoId: number;
  contatoId: number | null;
  vencimento: string;
  valor: number;
  situacao: SituacaoParcela;
}

export interface CompradorAcademy {
  contatoId: number;
  nome: string;
  documentoMascarado: string | null;
  compras: number;
  totalComprado: number;
  /** Bruto − taxas − impostos. */
  totalLiquido: number;
  /** Compras (uma linha por curso) para filtrar por período na tela. */
  vendas: { data: string; pedido: number; valor: number }[];
  /** Cursos comprados (edições), do mais recente para o mais antigo. */
  cursos: { nome: string; slug: string }[];
  primeiraCompra: string;
  ultimaCompra: string;
  emAtraso: number;
  parcelasAtrasadas: number;
  emAberto: number;
}

export interface InadimplenteAcademy {
  contatoId: number;
  nome: string;
  documentoMascarado: string | null;
  cursos: string[];
  pedidos: string[];
  totalAtrasado: number;
  parcelasAtrasadas: number;
  vencidoDesde: string;
  diasAtraso: number;
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Vendas (via carregarVendasAcademy) + parcelas dos pedidos válidos. */
export async function carregarCarteiraAcademy(supabase: Supa) {
  const academy = await carregarVendasAcademy(supabase);
  const pedidosValidos = new Set(academy.vendas.map((v) => v.blingPedidoId));
  const linhas: Database["public"]["Tables"]["academy_parcelas"]["Row"][] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase.from("academy_parcelas").select("*").range(pagina * 1000, pagina * 1000 + 999);
    if (error) {
      console.error("[academy] parcelas:", error.message);
      break;
    }
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // O contato da parcela pode faltar na listagem: vem da venda.
  const contatoDoPedido = new Map(academy.vendas.map((v) => [v.blingPedidoId, v.contatoId]));
  const parcelas: ParcelaAcademy[] = linhas
    .filter((p) => pedidosValidos.has(p.bling_pedido_id))
    .map((p) => ({
      id: p.id,
      blingPedidoId: p.bling_pedido_id,
      contatoId: p.contato_id ?? contatoDoPedido.get(p.bling_pedido_id) ?? null,
      vencimento: p.vencimento,
      valor: Number(p.valor),
      situacao: classificarSituacaoParcela(p.situacao, p.vencimento),
    }));
  return { ...academy, parcelas, temParcelas: linhas.length > 0 };
}

type Carteira = Awaited<ReturnType<typeof carregarCarteiraAcademy>>;

/** Compradores do Academy (um por contato do Bling), do mais recente para o mais antigo. */
export function compradoresAcademy({ vendas, parcelas }: Pick<Carteira, "vendas" | "parcelas">): CompradorAcademy[] {
  const porContato = new Map<number, VendaAcademy[]>();
  for (const v of vendas) if (v.contatoId) porContato.set(v.contatoId, [...(porContato.get(v.contatoId) ?? []), v]);
  const parcelasPorContato = new Map<number, ParcelaAcademy[]>();
  for (const p of parcelas) if (p.contatoId) parcelasPorContato.set(p.contatoId, [...(parcelasPorContato.get(p.contatoId) ?? []), p]);

  return [...porContato]
    .map(([contatoId, lista]) => {
      const ps = parcelasPorContato.get(contatoId) ?? [];
      const atrasadas = ps.filter((p) => p.situacao === "atrasada");
      const cursos = new Map<string, { nome: string; slug: string }>();
      for (const v of lista) cursos.set(v.cursoSlug, { nome: v.curso, slug: v.cursoSlug });
      return {
        contatoId,
        nome: lista[0].cliente,
        documentoMascarado: lista[0].documentoMascarado,
        compras: new Set(lista.map((v) => v.blingPedidoId)).size,
        totalComprado: lista.reduce((s, v) => s + v.valorTotal, 0),
        totalLiquido: lista.reduce((s, v) => s + v.liquido, 0),
        vendas: lista.map((v) => ({ data: v.dataVenda, pedido: v.blingPedidoId, valor: v.valorTotal })),
        cursos: [...cursos.values()],
        primeiraCompra: lista.at(-1)!.dataVenda,
        ultimaCompra: lista[0].dataVenda,
        emAtraso: atrasadas.reduce((s, p) => s + p.valor, 0),
        parcelasAtrasadas: atrasadas.length,
        emAberto: ps.filter((p) => p.situacao === "em_aberto").reduce((s, p) => s + p.valor, 0),
      };
    })
    .sort((a, b) => b.ultimaCompra.localeCompare(a.ultimaCompra));
}

/**
 * Inadimplência do Academy: compradores com parcela vencida, faixas de atraso e
 * resumo. `desde` (aaaa-mm-dd): só parcelas com vencimento a partir dessa data
 * (Dashboard: as previstas para vencer no período). Taxa = vencido e não pago
 * ÷ tudo o que já venceu (pago ou não) — decisão de produto, out/2026.
 */
export function inadimplenciaAcademy({ vendas, parcelas: todasParcelas }: Pick<Carteira, "vendas" | "parcelas">, desde?: string) {
  const hoje = hojeLocal();
  const parcelas = desde ? todasParcelas.filter((p) => p.vencimento >= desde) : todasParcelas;
  const vendasPorPedido = new Map<number, VendaAcademy[]>();
  for (const v of vendas) vendasPorPedido.set(v.blingPedidoId, [...(vendasPorPedido.get(v.blingPedidoId) ?? []), v]);
  const vencidas = parcelas.filter((p) => p.situacao === "atrasada");
  const aVencer = parcelas.filter((p) => p.situacao === "em_aberto");

  const porContato = new Map<number, ParcelaAcademy[]>();
  for (const p of vencidas) if (p.contatoId) porContato.set(p.contatoId, [...(porContato.get(p.contatoId) ?? []), p]);
  const clientes: InadimplenteAcademy[] = [...porContato]
    .map(([contatoId, lista]) => {
      const vendasDoContato = lista.flatMap((p) => vendasPorPedido.get(p.blingPedidoId) ?? []);
      const maisAntiga = lista.reduce((min, p) => (p.vencimento < min ? p.vencimento : min), lista[0].vencimento);
      return {
        contatoId,
        nome: vendasDoContato[0]?.cliente ?? "—",
        documentoMascarado: vendasDoContato[0]?.documentoMascarado ?? null,
        cursos: [...new Set(vendasDoContato.map((v) => v.curso))],
        pedidos: [...new Set(vendasDoContato.map((v) => v.numeroPedido))],
        totalAtrasado: lista.reduce((s, p) => s + p.valor, 0),
        parcelasAtrasadas: lista.length,
        vencidoDesde: maisAntiga,
        diasAtraso: diasEntre(maisAntiga, hoje),
      };
    })
    // Vencimento mais recente primeiro (decisão de produto, out/2026); empate pelo valor.
    .sort((a, b) => a.diasAtraso - b.diasAtraso || b.totalAtrasado - a.totalAtrasado);

  // Faixas pelo atraso de CADA parcela; clientes = quantos têm parcela na faixa.
  const faixas = FAIXAS_ATRASO.map((f, i) => {
    const de = i === 0 ? 1 : FAIXAS_ATRASO[i - 1].ate + 1;
    const naFaixa = vencidas.filter((p) => {
      const dias = diasEntre(p.vencimento, hoje);
      return dias >= de && dias <= f.ate;
    });
    return { ...f, valor: naFaixa.reduce((s, p) => s + p.valor, 0), clientes: new Set(naFaixa.map((p) => p.contatoId)).size };
  });

  const totalVencido = vencidas.reduce((s, p) => s + p.valor, 0);
  const totalAVencer = aVencer.reduce((s, p) => s + p.valor, 0);
  // Base da taxa: valor de todas as parcelas que já venceram (até hoje), pagas ou não.
  const totalJaVencido = parcelas.filter((p) => p.vencimento < hoje).reduce((s, p) => s + p.valor, 0);
  return {
    clientes,
    faixas,
    resumo: {
      totalVencido,
      parcelasVencidas: vencidas.length,
      totalAVencer,
      totalJaVencido,
      taxa: totalJaVencido > 0 ? totalVencido / totalJaVencido : 0,
      clientes: clientes.length,
      clientesComAberto: new Set([...vencidas, ...aVencer].map((p) => p.contatoId)).size,
    },
  };
}

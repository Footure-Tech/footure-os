import type { StatusPedido } from "@/lib/supabase/database.types";

// Abas de filtro da lista "Pedidos de venda", agrupando os status reais.
export const ABAS_PEDIDOS = [
  { valor: "aprovacao", rotulo: "Aguardando aprovação", status: ["em_aprovacao"] },
  { valor: "todos", rotulo: "Todos", status: null },
  { valor: "rascunho", rotulo: "Rascunhos", status: ["rascunho"] },
  { valor: "juridico", rotulo: "No jurídico", status: ["aprovado", "em_revisao_juridica", "pronto_para_assinatura"] },
  { valor: "assinatura", rotulo: "Aguardando assinatura", status: ["enviado_para_assinatura"] },
  { valor: "assinados", rotulo: "Assinados", status: ["assinado", "concluido"] },
  { valor: "cancelados", rotulo: "Cancelados", status: ["cancelado"] },
] as const satisfies readonly { valor: string; rotulo: string; status: readonly StatusPedido[] | null }[];

export type AbaPedidos = (typeof ABAS_PEDIDOS)[number]["valor"];

export function abaValida(valor: string | undefined, padrao: AbaPedidos): AbaPedidos {
  return ABAS_PEDIDOS.some((a) => a.valor === valor) ? (valor as AbaPedidos) : padrao;
}

export function statusNaAba(aba: AbaPedidos, status: StatusPedido): boolean {
  const def = ABAS_PEDIDOS.find((a) => a.valor === aba)!;
  return def.status === null || (def.status as readonly StatusPedido[]).includes(status);
}

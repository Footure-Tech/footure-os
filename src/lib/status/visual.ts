// Mapeamento dos status reais do sistema para o vocabulário visual do
// handoff Footure Gestão (rótulo + tom do StatusPill). Módulo neutro (sem
// "use client"): usado por Server e Client Components.
import type { StatusPedido } from "@/lib/supabase/database.types";
import type { SituacaoParcela } from "@/lib/integracoes/bling";
import type { SituacaoCliente } from "@/lib/clientes/situacao";

export type TomStatus = "in_progress" | "completed" | "not_started" | "active" | "inactive" | "pending";

export interface StatusVisual {
  rotulo: string;
  tom: TomStatus;
}

/**
 * Ciclo do pedido → contrato numa pílula só. O fluxo real tem etapas que o
 * protótipo não tem (aprovação da diretoria; liberação antes do envio à
 * Clicksign) — decisão: manter o fluxo e agrupar no vocabulário do handoff.
 * "Em aprovação" e "Cancelado" são extras do sistema real.
 */
export const STATUS_PEDIDO_VISUAL: Record<StatusPedido, StatusVisual> = {
  rascunho: { rotulo: "Rascunho", tom: "not_started" },
  em_aprovacao: { rotulo: "Em aprovação", tom: "pending" },
  aprovado: { rotulo: "Em geração", tom: "not_started" },
  em_revisao_juridica: { rotulo: "Em validação", tom: "pending" },
  pronto_para_assinatura: { rotulo: "Em validação", tom: "pending" },
  enviado_para_assinatura: { rotulo: "Aguard. assinatura", tom: "in_progress" },
  assinado: { rotulo: "Assinado", tom: "completed" },
  concluido: { rotulo: "Concluído", tom: "completed" },
  cancelado: { rotulo: "Cancelado", tom: "inactive" },
};

/** Pedido aprovado cuja geração automática do contrato falhou — destaque de erro em vez de "Em geração". */
export function statusPedidoVisual(status: StatusPedido, geracaoContratoErro?: string | null): StatusVisual {
  if (status === "aprovado" && geracaoContratoErro) return { rotulo: "Falha na geração", tom: "inactive" };
  return STATUS_PEDIDO_VISUAL[status];
}

/** Parcela do Bling (contas a receber). "Paga parcial" é extra do sistema real. */
export const STATUS_PARCELA_VISUAL: Record<SituacaoParcela, StatusVisual> = {
  em_aberto: { rotulo: "Em aberto", tom: "not_started" },
  recebida: { rotulo: "Paga", tom: "completed" },
  recebida_parcial: { rotulo: "Paga parcial", tom: "pending" },
  atrasada: { rotulo: "Vencida", tom: "inactive" },
};

/** Situação financeira de um contrato/cliente na carteira. */
export function statusCarteiraVisual(atrasado: boolean): StatusVisual {
  return atrasado ? { rotulo: "Atrasado", tom: "inactive" } : { rotulo: "Em dia", tom: "active" };
}

/** Dias de atraso: acima de 60 é crítico. */
export function statusAtrasoVisual(dias: number): StatusVisual {
  return { rotulo: `${dias} ${dias === 1 ? "dia" : "dias"}`, tom: dias > 60 ? "inactive" : "pending" };
}

/** Situação do cliente (lista e detalhe de Clientes). */
export const STATUS_CLIENTE_VISUAL: Record<SituacaoCliente, StatusVisual> = {
  em_dia: { rotulo: "Em dia", tom: "active" },
  atrasado: { rotulo: "Atrasado", tom: "inactive" },
  cancelado: { rotulo: "Cancelado", tom: "not_started" },
  inativo: { rotulo: "Inativo", tom: "not_started" },
  sem_contrato: { rotulo: "Sem contrato", tom: "not_started" },
};

export const STATUS_CLIENTE_NAO_CADASTRADO: StatusVisual = { rotulo: "Não cadastrado", tom: "pending" };

/** Situação do contrato (pedido de venda do Bling) — tela Financeiro · Contratos. */
export const STATUS_CONTRATO_VISUAL: Record<"em_dia" | "atrasado" | "concluido" | "cancelado", StatusVisual> = {
  em_dia: { rotulo: "Em dia", tom: "active" },
  atrasado: { rotulo: "Atrasado", tom: "inactive" },
  concluido: { rotulo: "Concluído", tom: "completed" },
  cancelado: { rotulo: "Cancelado", tom: "not_started" },
};

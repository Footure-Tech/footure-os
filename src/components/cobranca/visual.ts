import type { EntregaEnvioCobranca, StatusEnvioCobranca, TipoEnvioCobranca } from "@/lib/supabase/database.types";
import type { TomStatus } from "@/lib/status/visual";

export const ROTULO_TIPO_ENVIO: Record<TipoEnvioCobranca, string> = {
  cobranca: "Cobrança (boleto)",
  lembrete: "Lembrete",
  vencimento: "Vence hoje",
  atraso: "Atraso",
  escalonamento: "Escalonamento",
};
export const TOM_TIPO_ENVIO: Record<TipoEnvioCobranca, TomStatus> = {
  cobranca: "completed",
  lembrete: "in_progress",
  vencimento: "pending",
  atraso: "inactive",
  escalonamento: "not_started",
};

export const STATUS_ENVIO_VISUAL: Record<StatusEnvioCobranca, { rotulo: string; tom: TomStatus }> = {
  pendente: { rotulo: "Aguardando", tom: "pending" },
  enviado: { rotulo: "Enviado", tom: "active" },
  erro: { rotulo: "Falhou", tom: "inactive" },
  descartado: { rotulo: "Descartado", tom: "not_started" },
  cancelado: { rotulo: "Cancelado (pago)", tom: "not_started" },
};

export const ENTREGA_VISUAL: Record<EntregaEnvioCobranca, { rotulo: string; tom: TomStatus }> = {
  entregue: { rotulo: "Entregue", tom: "completed" },
  atrasada: { rotulo: "Atrasada", tom: "pending" },
  devolvido: { rotulo: "Devolvido", tom: "inactive" },
  spam: { rotulo: "Marcado como spam", tom: "inactive" },
};

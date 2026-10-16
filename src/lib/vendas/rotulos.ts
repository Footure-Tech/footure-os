import type { OrigemVenda, TipoVenda } from "@/lib/supabase/database.types";

// Rótulos de 0038 — usados na edição e no detalhe do contrato.
export const ROTULO_TIPO_VENDA: Record<TipoVenda, string> = {
  novo: "Novo contrato",
  renovacao: "Renovação",
  reativacao: "Reativação",
};

export const ROTULO_ORIGEM_VENDA: Record<OrigemVenda, string> = {
  carteira: "Carteira",
  inbound: "Inbound",
  outbound: "Outbound",
};

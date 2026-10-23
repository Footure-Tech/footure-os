import type { ApiModelo, Divulgacao, OrigemVenda, TipoVenda } from "@/lib/supabase/database.types";

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

// Condições do pedido — os mesmos rótulos no formulário e na revisão (detalhe do pedido).
export const ROTULO_API_MODELO: Record<ApiModelo, string> = {
  combinado: "Combinado (um boleto só, valor somado)",
  distintos: "Boletos distintos (API e software separados)",
};

export const ROTULO_DIVULGACAO: Record<Divulgacao, string> = {
  nenhuma: "Nenhuma",
  simples: "Simples (cliente autoriza citar como referência)",
  obrigacao: "Divulgação mútua (desconto opcional)",
};

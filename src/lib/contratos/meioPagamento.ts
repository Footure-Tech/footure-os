// Dado interno/CRM — não muda o texto do contrato (Cláusula Oitava sempre
// diz "boleto bancário", decisão registrada na conversa; nenhum dos 4
// contratos-modelo usa outro meio, então nenhum texto novo foi inventado).
import type { MeioPagamento } from "@/lib/supabase/database.types";

export const ROTULO_MEIO_PAGAMENTO: Record<MeioPagamento, string> = {
  boleto: "Boleto",
  pix: "PIX",
  transferencia_bancaria: "Transferência bancária",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};

/** Opções do formulário de pedido — cartão de débito saiu (decisão de produto,
 * out/2026: sem forma de pagamento no Bling). O rótulo acima fica só para exibir
 * algum pedido antigo. */
export const MEIOS_PAGAMENTO_DISPONIVEIS: Exclude<MeioPagamento, "cartao_debito">[] = ["boleto", "pix", "transferencia_bancaria", "cartao_credito"];

import type { ItemValidacaoContrato } from "@/lib/supabase/database.types";

// Itens do checklist de validação jurídica (handoff, tela Contratos).
export const ITENS_VALIDACAO: { item: ItemValidacaoContrato; rotulo: string }[] = [
  { item: "dados_cadastrais", rotulo: "Dados cadastrais e CNPJ conferidos" },
  { item: "valores_parcelas", rotulo: "Valores e parcelas conforme pedido" },
  { item: "clausulas_padrao", rotulo: "Cláusulas padrão do modelo mantidas" },
  { item: "anexo_plano", rotulo: "Anexo de plano e licenças incluído" },
];

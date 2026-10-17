"use server";

import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";

/**
 * CPF/CNPJ completo de um comprador do Academy, sob ação explícita na tela
 * (o relatório só traz o documento mascarado). Mesmos papéis da tela de Vendas.
 */
export async function revelarDocumentoAction(blingPedidoId: number): Promise<{ documento?: string; erro?: string }> {
  await exigirPapel("admin", "vendedor");
  const supabase = await createClient();
  const { data, error } = await supabase.from("academy_vendas").select("contato_documento").eq("bling_pedido_id", blingPedidoId).maybeSingle();
  if (error) return { erro: error.message };
  const doc = data?.contato_documento;
  if (!doc) return { erro: "Documento não informado no Bling." };
  if (doc.length === 11) return { documento: doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") };
  if (doc.length === 14) return { documento: doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") };
  return { documento: doc };
}

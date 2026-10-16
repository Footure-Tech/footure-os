"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { montarDadosContrato } from "@/lib/contratos/montarDados";
import { ajustesAplicadosNaUltimaGeracao, gerarContrato, gerarContratoBuffer } from "@/lib/contratos/gerarContrato";
import { carregarAjustesModelo } from "@/lib/contratos/ajustesModelo";
import { extrairParagrafos } from "@/lib/contratos/diffVersoes";

/**
 * Decisão do jurídico sobre uma mudança da nova versão (0041). "agregar"
 * cria um ajuste do modelo — aplicado automaticamente nas próximas gerações
 * do mesmo perfil — depois de conferir que:
 *   • é uma alteração (não inclusão/remoção de parágrafo inteiro) e a IA não a
 *     marcou como específica do cliente;
 *   • o trecho original existe no contrato que o modelo gera HOJE para este
 *     pedido (não veio de uma edição anterior);
 *   • a troca de fato acontece (o trecho não atravessa negrito/rótulo).
 */
export async function decidirMudancaAction(mudancaId: string, decisao: "agregar" | "manter"): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("juridico", "admin");
  const supabase = await createClient();

  const { data: mudanca, error: erroMudanca } = await supabase
    .from("contrato_mudancas")
    // contrato_analises aponta duas vezes para contratos (versão nova e base) — precisa nomear a ligação.
    .select("id, tipo, trecho_original, trecho_novo, sugestao, decisao, contrato_analises(contratos!contrato_analises_contrato_id_fkey(pedido_id))")
    .eq("id", mudancaId)
    .single();
  if (erroMudanca || !mudanca) return { erro: erroMudanca ? `Não foi possível ler a mudança: ${erroMudanca.message}` : "Mudança não encontrada." };
  const pedidoId = (mudanca.contrato_analises as unknown as { contratos: { pedido_id: string } | null } | null)?.contratos?.pedido_id;
  if (!pedidoId) return { erro: "Contrato da mudança não encontrado." };

  const registrar = async (valor: "agregar" | "manter") =>
    supabase.from("contrato_mudancas").update({ decisao: valor, decidido_por: sessao.id, decidido_em: new Date().toISOString() }).eq("id", mudancaId);

  if (decisao === "manter") {
    const { error } = await registrar("manter");
    if (error) return { erro: error.message };
  } else {
    if (mudanca.decisao === "agregar") return {};
    if (mudanca.tipo !== "alterado") return { erro: "Só alterações de texto podem ir para o modelo — inclusão ou remoção de parágrafo inteiro precisa ser feita no modelo pela equipe técnica." };
    if (mudanca.sugestao === "especifico") return { erro: "A análise indicou que esta mudança é específica deste cliente (dados ou condições negociadas) — ela fica só neste contrato." };
    const de = mudanca.trecho_original.trim();
    const para = mudanca.trecho_novo.trim();
    if (de.length < 10 || de === para) return { erro: "Trecho curto demais para ser aplicado com segurança no modelo." };

    const { data: pedido } = await supabase.from("pedidos").select("perfil").eq("id", pedidoId).single();
    if (!pedido) return { erro: "Pedido não encontrado." };
    const ajustes = await carregarAjustesModelo(supabase, pedido.perfil);
    const dados = await montarDadosContrato(supabase, pedidoId);

    const textoAtual = (await extrairParagrafos(await gerarContratoBuffer(dados, ajustes))).join("\n");
    if (!textoAtual.includes(de)) {
      return { erro: "O trecho original não está no contrato que o modelo gera hoje (pode ter vindo de uma edição anterior) — não dá para agregar automaticamente." };
    }
    gerarContrato(dados, [...ajustes, { id: "teste", de, para }]);
    if (!ajustesAplicadosNaUltimaGeracao().includes("teste")) {
      return { erro: "O trecho atravessa uma formatação do modelo (negrito ou rótulo de cláusula) e não pode ser trocado automaticamente." };
    }

    const { error } = await supabase
      .from("modelo_contrato_ajustes")
      .insert({ perfil: pedido.perfil, trecho_original: de, trecho_novo: para, mudanca_id: mudancaId, criado_por: sessao.id });
    if (error) return { erro: `Não foi possível agregar ao modelo: ${error.message}` };
    const { error: erroDecisao } = await registrar("agregar");
    if (erroDecisao) return { erro: erroDecisao.message };
  }

  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/** Diretoria/jurídico desativa um ajuste do modelo — as próximas gerações voltam ao texto original. */
export async function desativarAjusteModeloAction(ajusteId: string): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("juridico", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("modelo_contrato_ajustes")
    .update({ ativo: false, desativado_por: sessao.id, desativado_em: new Date().toISOString() })
    .eq("id", ajusteId);
  if (error) return { erro: error.message };
  revalidatePath("/admin/configuracoes");
  return {};
}

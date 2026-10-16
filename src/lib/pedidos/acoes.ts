// Orquestração de negócio da máquina de estados (PROMPT.md seção 4). Cada
// função assume que o chamador (Server Action) já autorizou o papel via
// exigirPapel() — a legalidade fina da transição (quem pode ir de onde pra
// onde) é responsabilidade do RPC registrar_transicao (defesa em
// profundidade, ver supabase/migrations/0004_transicoes_rpc.sql).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { gerarContratoBuffer, type Signatario } from "@/lib/contratos/gerarContrato";

type SignatarioClienteRow = Database["public"]["Tables"]["signatarios_cliente"]["Row"];
import { montarDadosContrato } from "@/lib/contratos/montarDados";
import { podeLiberarParaAssinatura } from "@/lib/validacoes/pedido";
import { enviarPedidoAoBling } from "@/lib/integracoes/blingPedido";
import { enviarParaAssinatura } from "@/lib/integracoes/clicksign";

type Supa = SupabaseClient<Database>;

async function registrarTransicao(supabase: Supa, pedidoId: string, para: Database["public"]["Tables"]["pedidos"]["Row"]["status"], comentario?: string) {
  const { error } = await supabase.rpc("registrar_transicao", {
    p_pedido_id: pedidoId,
    p_para: para,
    p_comentario: comentario ?? null,
  });
  if (error) throw new Error(`Transição para "${para}" recusada: ${error.message}`);
}

async function proximaVersaoContrato(supabase: Supa, pedidoId: string): Promise<number> {
  const { data } = await supabase
    .from("contratos")
    .select("versao")
    .eq("pedido_id", pedidoId)
    .order("versao", { ascending: false })
    .limit(1);
  return (data?.[0]?.versao ?? 0) + 1;
}

async function gerarEArmazenarContrato(supabase: Supa, pedidoId: string, geradoPor: string, motivoVersao?: string) {
  const dados = await montarDadosContrato(supabase, pedidoId);
  const buffer = await gerarContratoBuffer(dados);
  const versao = await proximaVersaoContrato(supabase, pedidoId);
  const path = `${pedidoId}/v${versao}.docx`;

  const { error: erroUpload } = await supabase.storage.from("contratos").upload(path, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (erroUpload) throw new Error(`Falha ao salvar o .docx no Storage: ${erroUpload.message}`);

  const { error: erroInsert } = await supabase.from("contratos").insert({
    pedido_id: pedidoId,
    versao,
    arquivo_path: path,
    gerado_por: geradoPor,
    motivo_versao: motivoVersao,
  });
  if (erroInsert) throw new Error(`Falha ao registrar a versão do contrato: ${erroInsert.message}`);

  return { versao, path };
}

/**
 * APROVADO -> EM_REVISAO_JURIDICA. Se a geração falhar, NÃO relança — grava
 * o erro em pedidos.geracao_contrato_erro e deixa o pedido visível em
 * APROVADO (seção 4), com um botão "tentar gerar novamente" reexecutando
 * esta mesma função.
 */
export async function tentarGerarContrato(supabase: Supa, pedidoId: string, geradoPor: string) {
  try {
    await gerarEArmazenarContrato(supabase, pedidoId, geradoPor, "Geração automática na aprovação.");
    await supabase.from("pedidos").update({ geracao_contrato_erro: null }).eq("id", pedidoId);
    await registrarTransicao(supabase, pedidoId, "em_revisao_juridica", "Contrato gerado automaticamente na aprovação.");
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await supabase.from("pedidos").update({ geracao_contrato_erro: mensagem }).eq("id", pedidoId);
  }
}

export async function enviarParaAprovacao(supabase: Supa, pedidoId: string) {
  await registrarTransicao(supabase, pedidoId, "em_aprovacao");
}

export async function reprovarPedido(supabase: Supa, pedidoId: string, comentario: string) {
  await registrarTransicao(supabase, pedidoId, "rascunho", comentario);
}

/**
 * EM_APROVACAO -> APROVADO e, em seguida, as duas frentes da aprovação:
 * • envia o pedido ao Bling (blingPedido.ts) — nunca trava a aprovação: em
 *   erro fica pedidos.bling_erro e o botão "Reenviar ao Bling";
 * • com contrato: gera o contrato e segue para o jurídico (como antes);
 *   sem contrato (gera_contrato = false): concluído assim que o Bling recebe.
 */
export async function aprovarPedido(supabase: Supa, pedidoId: string, adminId: string) {
  await registrarTransicao(supabase, pedidoId, "aprovado");
  const { data: pedido } = await supabase.from("pedidos").select("gera_contrato").eq("id", pedidoId).single();
  const envio = await enviarPedidoAoBling(supabase, pedidoId);

  if (pedido?.gera_contrato === false) {
    if (envio.ok) await registrarTransicao(supabase, pedidoId, "concluido", "Pedido sem contrato — enviado ao Bling na aprovação.");
    return;
  }
  await tentarGerarContrato(supabase, pedidoId, adminId);
}

/** "Reenviar ao Bling": refaz o envio (sem duplicar) e, se o pedido é sem contrato e ficou parado em APROVADO, conclui. */
export async function reenviarPedidoAoBling(supabase: Supa, pedidoId: string) {
  const envio = await enviarPedidoAoBling(supabase, pedidoId);
  if (!envio.ok) throw new Error(envio.erro);
  const { data: pedido } = await supabase.from("pedidos").select("status, gera_contrato").eq("id", pedidoId).single();
  if (pedido && !pedido.gera_contrato && pedido.status === "aprovado") {
    await registrarTransicao(supabase, pedidoId, "concluido", "Pedido sem contrato — enviado ao Bling.");
  }
  return envio;
}

/** Jurídico sobe uma edição — nova versão, SEM mudar o estado (permanece em EM_REVISAO_JURIDICA). */
export async function subirNovaVersaoContrato(
  supabase: Supa,
  pedidoId: string,
  arquivo: Buffer,
  geradoPor: string,
  motivoVersao: string,
) {
  const versao = await proximaVersaoContrato(supabase, pedidoId);
  const path = `${pedidoId}/v${versao}.docx`;

  const { error: erroUpload } = await supabase.storage.from("contratos").upload(path, arquivo, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (erroUpload) throw new Error(`Falha ao salvar o .docx no Storage: ${erroUpload.message}`);

  const { error: erroInsert } = await supabase.from("contratos").insert({
    pedido_id: pedidoId,
    versao,
    arquivo_path: path,
    gerado_por: geradoPor,
    motivo_versao: motivoVersao,
  });
  if (erroInsert) throw new Error(`Falha ao registrar a versão do contrato: ${erroInsert.message}`);

  return { versao, path };
}

async function buscarRepresentantesLegaisDoPedido(supabase: Supa, pedidoId: string): Promise<Signatario[]> {
  const { data } = await supabase
    .from("pedido_signatarios")
    .select("tipo, signatarios_cliente(nome_completo, email, cpf)")
    .eq("pedido_id", pedidoId)
    .eq("tipo", "representante_legal");

  return (data ?? [])
    .map((r) => r.signatarios_cliente as unknown as SignatarioClienteRow | null)
    .filter((s): s is SignatarioClienteRow => !!s)
    .map((s) => ({ nomeCompleto: s.nome_completo, email: s.email, cpf: s.cpf }));
}

/** EM_REVISAO_JURIDICA -> PRONTO_PARA_ASSINATURA, com a trava dura (seção 6.2 item 7). */
export async function liberarParaAssinatura(supabase: Supa, pedidoId: string, comentario?: string) {
  const representantes = await buscarRepresentantesLegaisDoPedido(supabase, pedidoId);
  const gate = podeLiberarParaAssinatura(representantes);
  if (!gate.ok) throw new Error(gate.motivo);

  await registrarTransicao(supabase, pedidoId, "pronto_para_assinatura", comentario);
}

/** EM_REVISAO_JURIDICA -> APROVADO -> (regeneração automática) -> EM_REVISAO_JURIDICA. */
export async function rejeitarContrato(supabase: Supa, pedidoId: string, ator: string, comentario: string) {
  await registrarTransicao(supabase, pedidoId, "aprovado", comentario);
  await tentarGerarContrato(supabase, pedidoId, ator);
}

/** PRONTO_PARA_ASSINATURA -> ENVIADO_PARA_ASSINATURA. Cria o envelope na Clicksign
 * (documento + signatários + requirements) e só then registra a transição — se o
 * envio falhar, o pedido permanece em PRONTO_PARA_ASSINATURA. */
export async function enviarPedidoParaAssinatura(supabase: Supa, pedidoId: string, comentario?: string) {
  const { data: contrato } = await supabase
    .from("contratos")
    .select("id, arquivo_path")
    .eq("pedido_id", pedidoId)
    .order("versao", { ascending: false })
    .limit(1)
    .single();

  if (contrato) {
    await enviarParaAssinatura(supabase, { contratoId: contrato.id, pedidoId, arquivoPath: contrato.arquivo_path });
  }

  await registrarTransicao(supabase, pedidoId, "enviado_para_assinatura", comentario ?? "Enviado para assinatura via Clicksign.");
}

/** Vendedor editou um pedido além do rascunho — reabre o fluxo do zero em vez de deixar
 * um contrato já gerado/aprovado ficar desatualizado em relação aos dados sem ninguém perceber. */
export async function reabrirParaEdicao(supabase: Supa, pedidoId: string) {
  await registrarTransicao(supabase, pedidoId, "rascunho", "Pedido editado pelo vendedor — reaberto para nova aprovação.");
  await supabase.from("pedidos").update({ geracao_contrato_erro: null }).eq("id", pedidoId);
}

/** PRONTO_PARA_ASSINATURA|ENVIADO_PARA_ASSINATURA -> EM_REVISAO_JURIDICA. Cancelamento manual
 * (stub Fase 3 — sem Clicksign real ainda) que reabilita a edição do pedido pelo vendedor. */
export async function cancelarAssinatura(supabase: Supa, pedidoId: string, comentario?: string) {
  await registrarTransicao(supabase, pedidoId, "em_revisao_juridica", comentario ?? "Processo de assinatura cancelado.");
}

/** Qualquer status não-terminal -> CANCELADO. Encerra o pedido de venda (diferente de
 * "cancelar assinatura", que só reabre o processo de assinatura — aqui o pedido morre). */
export async function cancelarPedido(supabase: Supa, pedidoId: string, comentario: string) {
  await registrarTransicao(supabase, pedidoId, "cancelado", comentario);
}

// Orquestração de negócio da máquina de estados (PROMPT.md seção 4). Cada
// função assume que o chamador (Server Action) já autorizou o papel via
// exigirPapel() — a legalidade fina da transição (quem pode ir de onde pra
// onde) é responsabilidade do RPC registrar_transicao (defesa em
// profundidade, ver supabase/migrations/0004_transicoes_rpc.sql).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { gerarContratoBuffer, type Signatario } from "@/lib/contratos/gerarContrato";
import { carregarAjustesModelo } from "@/lib/contratos/ajustesModelo";
import { analisarNovaVersao } from "@/lib/contratos/analisarVersao";

type SignatarioClienteRow = Database["public"]["Tables"]["signatarios_cliente"]["Row"];
import { montarDadosContrato } from "@/lib/contratos/montarDados";
import { podeLiberarParaAssinatura } from "@/lib/validacoes/pedido";
import { enviarPedidoAoBling } from "@/lib/integracoes/blingPedido";
import { notificarJuridicoContratoParaValidacao } from "@/lib/contratos/notificarJuridico";
import { notificarDiretoriaPedidoParaAprovacao } from "@/lib/pedidos/notificarDiretoria";
import { enviarParaAssinatura } from "@/lib/integracoes/clicksign";
import { createServiceClient } from "@/lib/supabase/service";

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
  const buffer = await gerarContratoBuffer(dados, await carregarAjustesModelo(supabase, dados.perfil));
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
    await gerarEArmazenarContrato(supabase, pedidoId, geradoPor, `${PREFIXO_GERACAO_AUTOMATICA} na aprovação.`);
    await supabase.from("pedidos").update({ geracao_contrato_erro: null }).eq("id", pedidoId);
    await registrarTransicao(supabase, pedidoId, "em_revisao_juridica", "Contrato gerado automaticamente na aprovação.");
    await notificarJuridicoContratoParaValidacao(pedidoId, "Um novo contrato foi gerado e está aguardando a validação do jurídico.");
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await supabase.from("pedidos").update({ geracao_contrato_erro: mensagem }).eq("id", pedidoId);
  }
}

export async function enviarParaAprovacao(supabase: Supa, pedidoId: string) {
  await registrarTransicao(supabase, pedidoId, "em_aprovacao");
  await notificarDiretoriaPedidoParaAprovacao(pedidoId);
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
/**
 * Upload de nova versão pelo jurídico, em duas etapas: o navegador sobe o
 * .docx direto para o Storage (URL assinada — Server Actions limitam o corpo a
 * 1 MB e a Vercel a 4,5 MB, e um .docx editado no Word passa disso fácil) e
 * depois registramos a versão. 1) reserva o caminho da próxima versão:
 */
export async function prepararUploadNovaVersao(supabase: Supa, pedidoId: string) {
  const versao = await proximaVersaoContrato(supabase, pedidoId);
  const path = `${pedidoId}/v${versao}.docx`;
  const { data, error } = await supabase.storage.from("contratos").createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Não foi possível preparar o envio: ${error?.message ?? "erro desconhecido"}`);
  return { versao, path: data.path, token: data.token };
}

/** 2) registra a versão já enviada ao Storage e compara com a anterior (análise 0041). */
export async function registrarNovaVersaoEnviada(supabase: Supa, pedidoId: string, versao: number, path: string, geradoPor: string, motivoVersao: string) {
  if (path !== `${pedidoId}/v${versao}.docx`) throw new Error("Caminho de arquivo inválido.");
  const { data: registro, error: erroInsert } = await supabase
    .from("contratos")
    .insert({ pedido_id: pedidoId, versao, arquivo_path: path, gerado_por: geradoPor, motivo_versao: motivoVersao || null })
    .select("id")
    .single();
  if (erroInsert || !registro) throw new Error(`Falha ao registrar a versão do contrato: ${erroInsert?.message}`);

  // Compara com a versão anterior e resume as mudanças (IA) para o jurídico decidir o que vai para o modelo.
  if (versao > 1) await analisarNovaVersao(supabase, pedidoId, registro.id, versao);
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
  const desatualizado = await contratoEmAssinaturaDesatualizado(supabase, pedidoId);
  await registrarTransicao(supabase, pedidoId, "em_revisao_juridica", comentario ?? "Processo de assinatura cancelado.");
  // Os dados mudaram durante a assinatura: a nova versão sai já com eles.
  const { data: usuario } = await supabase.auth.getUser();
  if (desatualizado && usuario.user) await atualizarContratosPorMudanca([pedidoId], "Assinatura cancelada com dados alterados", usuario.user.id);
}

/** Qualquer status não-terminal -> CANCELADO. Encerra o pedido de venda (diferente de
 * "cancelar assinatura", que só reabre o processo de assinatura — aqui o pedido morre). */
export async function cancelarPedido(supabase: Supa, pedidoId: string, comentario: string) {
  await registrarTransicao(supabase, pedidoId, "cancelado", comentario);
}

// ---------------------------------------------------------------------------
// Nova versão automática quando os dados do contrato mudam sem edição do
// pedido (cadastro do cliente, ajuste do modelo). Edição do pedido já gera
// nova versão pela reaprovação (reabrirParaEdicao → aprovarPedido).
// ---------------------------------------------------------------------------

/** Motivo das versões geradas pelo sistema — o que não começa assim foi enviado pelo jurídico ("Subir nova versão"). */
export const PREFIXO_GERACAO_AUTOMATICA = "Geração automática";
/** Nota na linha do tempo de pedido em assinatura cujos dados mudaram depois do envio. */
export const MARCA_CONTRATO_DESATUALIZADO = "Contrato em assinatura desatualizado:";

export function versaoGeradaPeloSistema(motivo: string | null | undefined) {
  return !!motivo?.startsWith(PREFIXO_GERACAO_AUTOMATICA);
}

/** Houve mudança de dados depois do último envio para assinatura? `transicoes` da mais recente para a mais antiga. */
export function desatualizadoDesdeOEnvio(transicoes: Array<{ de: string | null; para: string; comentario: string | null }>) {
  for (const t of transicoes) {
    if (t.de === t.para && t.comentario?.startsWith(MARCA_CONTRATO_DESATUALIZADO)) return true;
    if (t.para === "enviado_para_assinatura" && t.de !== t.para) return false;
  }
  return false;
}

async function contratoEmAssinaturaDesatualizado(supabase: Supa, pedidoId: string) {
  const { data } = await supabase.from("transicoes").select("de, para, comentario").eq("pedido_id", pedidoId).order("criado_em", { ascending: false }).limit(50);
  return desatualizadoDesdeOEnvio(data ?? []);
}

const STATUS_COM_CONTRATO_EM_ANDAMENTO = ["em_revisao_juridica", "pronto_para_assinatura", "enviado_para_assinatura"] as const;

/**
 * Para cada pedido com contrato em andamento:
 * • em revisão / pronto para assinatura, com versão atual gerada pelo sistema:
 *   gera a próxima versão (checklist em branco — é por versão) e, se estava
 *   pronto, volta para revisão jurídica;
 * • versão atual enviada pelo jurídico: não substitui (perderia as edições
 *   manuais) — só registra o aviso para ele conferir;
 * • em assinatura: não troca o documento em assinatura — registra o aviso
 *   (a tela mostra; cancelar a assinatura gera a versão nova).
 * Usa o service client: quem dispara pode ser o vendedor (edição do cliente),
 * que não grava contratos nem muda o status do contrato. Nunca lança.
 */
export async function atualizarContratosPorMudanca(pedidoIds: string[], motivo: string, ator: string) {
  if (pedidoIds.length === 0) return;
  const service = createServiceClient();
  const nota = (pedidoId: string, status: Database["public"]["Tables"]["pedidos"]["Row"]["status"], comentario: string) =>
    service.from("transicoes").insert({ pedido_id: pedidoId, de: status, para: status, ator_id: ator, comentario });

  const { data: pedidos } = await service
    .from("pedidos")
    .select("id, status, gera_contrato")
    .in("id", pedidoIds)
    .in("status", [...STATUS_COM_CONTRATO_EM_ANDAMENTO]);
  for (const pedido of pedidos ?? []) {
    if (!pedido.gera_contrato) continue;
    try {
      const { data: atual } = await service
        .from("contratos")
        .select("versao, motivo_versao")
        .eq("pedido_id", pedido.id)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!atual) continue;

      if (pedido.status === "enviado_para_assinatura") {
        await nota(pedido.id, pedido.status, `${MARCA_CONTRATO_DESATUALIZADO} ${motivo} depois do envio — o documento em assinatura não reflete a mudança. Cancele a assinatura para gerar uma nova versão.`);
        continue;
      }
      if (!versaoGeradaPeloSistema(atual.motivo_versao)) {
        await nota(pedido.id, pedido.status, `${motivo} depois da v${atual.versao}, enviada pelo jurídico — ela não foi substituída para não perder as edições manuais. Confira se precisa de ajuste.`);
        continue;
      }

      const { versao } = await gerarEArmazenarContrato(service, pedido.id, ator, `${PREFIXO_GERACAO_AUTOMATICA} — ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}.`);
      if (pedido.status === "pronto_para_assinatura") {
        await service.from("transicoes").insert({ pedido_id: pedido.id, de: "pronto_para_assinatura", para: "em_revisao_juridica", ator_id: ator, comentario: `${motivo} — nova versão v${versao} gerada; volta para validação jurídica.` });
        await service.from("pedidos").update({ status: "em_revisao_juridica" }).eq("id", pedido.id);
      } else {
        await nota(pedido.id, pedido.status, `${motivo} — nova versão v${versao} gerada automaticamente.`);
      }
      await notificarJuridicoContratoParaValidacao(pedido.id, `${motivo}: uma nova versão do contrato (v${versao}) foi gerada e aguarda validação.`);
    } catch (erro) {
      console.error(`[contrato] atualização automática do pedido ${pedido.id} falhou:`, erro instanceof Error ? erro.message : erro);
    }
  }
}

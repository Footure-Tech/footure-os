"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { normalizePlan, buscarPlanoPorKey } from "@/lib/plans/normalize";
import { podeRegistrarPedido } from "@/lib/validacoes/pedido";
import * as acoes from "@/lib/pedidos/acoes";
import { STATUS_EDITAVEIS } from "@/lib/pedidos/statusEditavel";

const SignatarioSchema = z.object({
  id: z.string().uuid().optional(), // já existente em signatarios_cliente
  nomeCompleto: z.string().min(1),
  email: z.string().email(),
  cpf: z.string().min(1),
});

const PedidoPayloadSchema = z.object({
  pedidoId: z.string().uuid().optional(), // presente = edição de rascunho
  clienteId: z.string().uuid().optional(),
  novoCliente: z
    .object({
      tipo: z.enum(["clube", "agente"]),
      razaoSocial: z.string().min(1),
      nomeFantasia: z.string().optional(),
      apelido: z.string().optional(), // só faz sentido pra clube — validado na UI, não aqui
      cnpj: z.string().min(1),
      endereco: z.string().min(1),
      numero: z.string().min(1),
      complemento: z.string().optional(),
      bairro: z.string().min(1),
      cep: z.string().min(1),
      municipio: z.string().min(1),
      uf: z.string().length(2),
    })
    .optional(),
  perfil: z.enum(["clube", "agente"]),
  produtos: z.array(z.enum(["footlink", "api"])).min(1),
  plano: z.string().min(1),
  planoLegadoNomeOriginal: z.string().nullable().optional(),
  planoLegadoConfirmado: z.boolean().default(false),
  licencasPagas: z.number().int().min(0),
  licencasGratuitas: z.number().int().min(0),
  formaPagamento: z.enum(["avista", "parcelado"]),
  meioPagamento: z.enum(["boleto", "pix", "transferencia_bancaria", "cartao_credito", "cartao_debito"]).default("boleto"),
  numeroParcelas: z.number().int().min(1).optional(),
  valorMensal: z.number().nonnegative(),
  valorTotal: z.number().nonnegative(),
  valorLicencaAdicional: z.number().nonnegative().optional(),
  valorMensalApi: z.number().nonnegative().optional(),
  valorMensalSoftware: z.number().nonnegative().optional(),
  primeiroPagamento: z.string().min(1),
  diaVencimento: z.number().int().min(1).max(31).optional(),
  convencaoParcelas: z.enum(["calendario", "ciclo"]).default("calendario"),
  vigenciaInicio: z.string().min(1),
  vigenciaFim: z.string().min(1),
  robusta: z.boolean().default(false),
  divulgacao: z.enum(["nenhuma", "simples", "obrigacao"]).default("simples"),
  percentualDescontoDivulgacao: z.number().nonnegative().optional(),
  postDivulgacao: z.string().optional(),
  apiModelo: z.enum(["combinado", "distintos"]).optional(),
  multaTipo: z.enum(["sem_multa", "duas_mensalidades", "tres_mensalidades", "retencao_total", "customizado"]),
  multaTexto: z.string().min(1),
  foro: z.string().min(1),
  condicaoEspecial: z.string().optional(),
  representantesLegais: z.array(SignatarioSchema),
  testemunhasCliente: z.array(SignatarioSchema),
  representantesFootureIds: z.array(z.string().uuid()),
  testemunhasFooture: z.array(SignatarioSchema),
  sdrId: z.string().uuid(),
  closerId: z.string().uuid(),
});

export type PedidoPayload = z.infer<typeof PedidoPayloadSchema>;

export interface SalvarPedidoState {
  erro?: string;
}

/** Cria (ou atualiza, se pedidoId vier no payload) um pedido em RASCUNHO. */
export async function salvarPedido(_prev: SalvarPedidoState, formData: FormData): Promise<SalvarPedidoState> {
  const sessao = await exigirPapel("vendedor", "admin");
  const bruto = JSON.parse(String(formData.get("payload") ?? "{}"));
  const parsed = PedidoPayloadSchema.safeParse(bruto);
  if (!parsed.success) {
    return { erro: `Dados inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  const payload = parsed.data;

  // `plano` é sempre a key canônica do registro (plan-registry.json) — nunca texto
  // livre. Se não resolver, os dados foram montados fora do fluxo normal do form.
  const planoResolvido = buscarPlanoPorKey(payload.plano);
  if (!planoResolvido || !payload.plano.startsWith(`${payload.perfil}:`)) {
    return { erro: `Plano "${payload.plano}" inválido para o perfil "${payload.perfil}".` };
  }

  // Nome de plano de geração anterior (campo livre "plano no pedido original")
  // nunca é convertido em silêncio — precisa de confirmação explícita do vendedor.
  if (payload.planoLegadoNomeOriginal && !payload.planoLegadoConfirmado) {
    const normalizado = normalizePlan(payload.perfil, payload.planoLegadoNomeOriginal);
    if (normalizado.status === "needs_confirmation") {
      return { erro: `Plano legado "${payload.planoLegadoNomeOriginal}" precisa de confirmação antes de salvar.` };
    }
  }

  const gate = podeRegistrarPedido({
    valorMensal: payload.valorMensal,
    valorTotal: payload.valorTotal,
    formaPagamento: payload.formaPagamento,
    numeroParcelas: payload.numeroParcelas,
    vigenciaInicio: payload.vigenciaInicio,
    vigenciaFim: payload.vigenciaFim,
  });
  if (!gate.ok) return { erro: gate.motivo };

  const supabase = await createClient();

  let clienteId = payload.clienteId;
  if (!clienteId && payload.novoCliente) {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        tipo: payload.novoCliente.tipo,
        razao_social: payload.novoCliente.razaoSocial,
        nome_fantasia: payload.novoCliente.nomeFantasia || null,
        apelido: payload.novoCliente.tipo === "clube" ? payload.novoCliente.apelido || null : null,
        cnpj: payload.novoCliente.cnpj,
        endereco: payload.novoCliente.endereco,
        numero: payload.novoCliente.numero,
        complemento: payload.novoCliente.complemento || null,
        bairro: payload.novoCliente.bairro,
        cep: payload.novoCliente.cep,
        municipio: payload.novoCliente.municipio,
        uf: payload.novoCliente.uf,
      })
      .select("id")
      .single();
    if (error || !cliente) return { erro: `Falha ao cadastrar cliente: ${error?.message}` };
    clienteId = cliente.id;

    const imagem = formData.get("imagemNovoCliente") as File | null;
    if (imagem && imagem.size > 0) {
      const path = `${clienteId}/logo`;
      const buffer = Buffer.from(await imagem.arrayBuffer());
      const { error: erroUpload } = await supabase.storage
        .from("logos-clientes")
        .upload(path, buffer, { contentType: imagem.type, upsert: true });
      if (!erroUpload) {
        await supabase.from("clientes").update({ logo_path: path }).eq("id", clienteId);
      }
    }
  }
  if (!clienteId) return { erro: "Selecione um cliente existente ou cadastre um novo." };
  if (payload.formaPagamento === "parcelado" && !payload.numeroParcelas) {
    return { erro: "Informe o número de parcelas para pagamento parcelado." };
  }

  const linhaPedido = {
    cliente_id: clienteId,
    vendedor_id: sessao.id,
    perfil: payload.perfil,
    produtos: payload.produtos,
    plano: payload.plano,
    licencas_pagas: payload.licencasPagas,
    licencas_gratuitas: payload.licencasGratuitas,
    forma_pagamento: payload.formaPagamento,
    meio_pagamento: payload.meioPagamento,
    numero_parcelas: payload.formaPagamento === "parcelado" ? payload.numeroParcelas : null,
    valor_mensal: payload.valorMensal,
    valor_total: payload.valorTotal,
    valor_licenca_adicional: payload.valorLicencaAdicional ?? null,
    valor_mensal_api: payload.valorMensalApi ?? null,
    valor_mensal_software: payload.valorMensalSoftware ?? null,
    primeiro_pagamento: payload.primeiroPagamento,
    dia_vencimento: payload.diaVencimento ?? null,
    convencao_parcelas: payload.convencaoParcelas,
    vigencia_inicio: payload.vigenciaInicio,
    vigencia_fim: payload.vigenciaFim,
    robusta: payload.robusta,
    divulgacao: payload.divulgacao,
    percentual_desconto_divulgacao: payload.divulgacao === "obrigacao" ? (payload.percentualDescontoDivulgacao ?? null) : null,
    post_divulgacao: payload.divulgacao === "obrigacao" ? payload.postDivulgacao || null : null,
    api_modelo: payload.produtos.includes("api") ? (payload.apiModelo ?? "distintos") : null,
    multa_tipo: payload.multaTipo,
    multa_texto: payload.multaTexto,
    foro: payload.foro,
    condicao_especial: payload.condicaoEspecial || null,
    plano_legado_detectado: !!payload.planoLegadoNomeOriginal,
    plano_legado_nome_original: payload.planoLegadoNomeOriginal || null,
    sdr_id: payload.sdrId,
    closer_id: payload.closerId,
  };

  let pedidoId = payload.pedidoId;
  if (pedidoId) {
    const { data: existente } = await supabase.from("pedidos").select("status").eq("id", pedidoId).single();
    if (!existente || !STATUS_EDITAVEIS.includes(existente.status)) {
      return { erro: "Este pedido não pode mais ser editado — o contrato já foi liberado para assinatura." };
    }
    const { error } = await supabase.from("pedidos").update(linhaPedido).eq("id", pedidoId);
    if (error) return { erro: `Falha ao salvar pedido: ${error.message}` };

    // Editar além do rascunho reabre o fluxo do zero — evita que um contrato
    // já gerado/aprovado fique desatualizado em relação aos dados do pedido.
    if (existente.status !== "rascunho") {
      await acoes.reabrirParaEdicao(supabase, pedidoId);
    }

    // Reconstrói os vínculos de signatários do zero — mais simples e seguro
    // que tentar diff incremental, dado que o formulário reenvia tudo.
    await Promise.all([
      supabase.from("pedido_signatarios").delete().eq("pedido_id", pedidoId),
      supabase.from("pedido_representantes_footure").delete().eq("pedido_id", pedidoId),
      supabase.from("pedido_testemunhas_footure").delete().eq("pedido_id", pedidoId),
    ]);
  } else {
    const { data: novo, error } = await supabase.from("pedidos").insert(linhaPedido).select("id").single();
    if (error || !novo) return { erro: `Falha ao criar pedido: ${error?.message}` };
    pedidoId = novo.id;
  }

  const erroSignatarios = await salvarSignatariosDoPedido(supabase, pedidoId, clienteId, payload);
  if (erroSignatarios) return { erro: erroSignatarios };

  // Botão "Enviar para aprovação" do formulário = salvar + a mesma transição
  // do botão do detalhe (rascunho -> em_aprovacao, validada pelo RPC). Se a
  // transição for recusada, o pedido já está salvo: segue em rascunho e o
  // detalhe mostra o envio manual — não devolve erro ao form, senão um novo
  // submit criaria um pedido duplicado.
  if (formData.get("intencao") === "enviar") {
    try {
      await acoes.enviarParaAprovacao(supabase, pedidoId);
    } catch (erro) {
      console.error("[salvarPedido] pedido salvo, mas o envio para aprovação falhou:", erro);
    }
  }

  revalidatePath("/vendedor");
  revalidatePath("/admin");
  redirect(`/pedidos/${pedidoId}`);
}

async function salvarSignatariosDoPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  clienteId: string,
  payload: PedidoPayload,
): Promise<string | null> {
  async function garantirSignatarioCliente(s: PedidoPayload["representantesLegais"][number], tipo: "representante_legal" | "testemunha") {
    if (s.id) return s.id;
    const { data, error } = await supabase
      .from("signatarios_cliente")
      .insert({ cliente_id: clienteId, tipo, nome_completo: s.nomeCompleto, email: s.email, cpf: s.cpf })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Falha ao salvar signatário "${s.nomeCompleto}": ${error?.message}`);
    return data.id;
  }

  try {
    for (const rep of payload.representantesLegais) {
      const signatarioClienteId = await garantirSignatarioCliente(rep, "representante_legal");
      const { error } = await supabase
        .from("pedido_signatarios")
        .insert({ pedido_id: pedidoId, signatario_cliente_id: signatarioClienteId, tipo: "representante_legal" });
      if (error) throw new Error(error.message);
    }
    for (const test of payload.testemunhasCliente) {
      const signatarioClienteId = await garantirSignatarioCliente(test, "testemunha");
      const { error } = await supabase
        .from("pedido_signatarios")
        .insert({ pedido_id: pedidoId, signatario_cliente_id: signatarioClienteId, tipo: "testemunha" });
      if (error) throw new Error(error.message);
    }
    for (const representanteFootureId of payload.representantesFootureIds) {
      const { error } = await supabase
        .from("pedido_representantes_footure")
        .insert({ pedido_id: pedidoId, representante_footure_id: representanteFootureId });
      if (error) throw new Error(error.message);
    }
    if (payload.testemunhasFooture.length > 0) {
      const { error } = await supabase.from("pedido_testemunhas_footure").insert(
        payload.testemunhasFooture.map((t) => ({
          pedido_id: pedidoId,
          nome_completo: t.nomeCompleto,
          email: t.email,
          cpf: t.cpf,
        })),
      );
      if (error) throw new Error(error.message);
    }
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
  return null;
}

export async function enviarParaAprovacaoAction(pedidoId: string) {
  await exigirPapel("vendedor", "admin");
  const supabase = await createClient();
  await acoes.enviarParaAprovacao(supabase, pedidoId);
  revalidatePath("/vendedor");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function aprovarPedidoAction(pedidoId: string) {
  const sessao = await exigirPapel("admin");
  const supabase = await createClient();
  await acoes.aprovarPedido(supabase, pedidoId, sessao.id);
  revalidatePath("/admin");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function reprovarPedidoAction(pedidoId: string, comentario: string) {
  await exigirPapel("admin");
  const supabase = await createClient();
  await acoes.reprovarPedido(supabase, pedidoId, comentario);
  revalidatePath("/admin");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function tentarGerarNovamenteAction(pedidoId: string) {
  const sessao = await exigirPapel("admin", "juridico");
  const supabase = await createClient();
  await acoes.tentarGerarContrato(supabase, pedidoId, sessao.id);
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function liberarParaAssinaturaAction(pedidoId: string, comentario?: string) {
  await exigirPapel("juridico", "admin");
  const supabase = await createClient();
  await acoes.liberarParaAssinatura(supabase, pedidoId, comentario);
  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function rejeitarContratoAction(pedidoId: string, comentario: string) {
  const sessao = await exigirPapel("juridico", "admin");
  const supabase = await createClient();
  await acoes.rejeitarContrato(supabase, pedidoId, sessao.id, comentario);
  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function enviarParaAssinaturaAction(pedidoId: string) {
  await exigirPapel("juridico", "admin");
  const supabase = await createClient();
  await acoes.enviarPedidoParaAssinatura(supabase, pedidoId);
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function cancelarAssinaturaAction(pedidoId: string, comentario?: string) {
  await exigirPapel("juridico", "admin");
  const supabase = await createClient();
  await acoes.cancelarAssinatura(supabase, pedidoId, comentario);
  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function cancelarPedidoAction(pedidoId: string, motivo: string, observacao?: string) {
  await exigirPapel("vendedor", "admin", "juridico");
  const supabase = await createClient();
  const comentario = observacao?.trim() ? `Motivo: ${motivo}. Observação: ${observacao.trim()}` : `Motivo: ${motivo}.`;
  await acoes.cancelarPedido(supabase, pedidoId, comentario);
  revalidatePath("/vendedor");
  revalidatePath("/admin");
  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export interface SubirVersaoState {
  erro?: string;
  sucesso?: boolean;
}

export async function subirNovaVersaoAction(_prev: SubirVersaoState, formData: FormData): Promise<SubirVersaoState> {
  const sessao = await exigirPapel("juridico", "admin");
  const pedidoId = String(formData.get("pedidoId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  const arquivo = formData.get("arquivo") as File | null;
  if (!pedidoId || !arquivo || arquivo.size === 0) {
    return { erro: "Selecione o arquivo .docx editado." };
  }

  const supabase = await createClient();
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  try {
    await acoes.subirNovaVersaoContrato(supabase, pedidoId, buffer, sessao.id, motivo);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : String(erro) };
  }
  revalidatePath("/juridico");
  revalidatePath(`/pedidos/${pedidoId}`);
  return { sucesso: true };
}

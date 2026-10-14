// Fase 3 (PROMPT.md seção 8) — webhook real da Clicksign. Assinado com HMAC
// SHA-256 (header `Content-Hmac: sha256=<hex>`, calculado sobre o corpo BRUTO
// da requisição — https://developers.clicksign.com "Segurança de Webhooks").
// Só o evento `document_closed` (todos assinaram) importa aqui: baixa o PDF
// assinado, guarda no Storage e move ENVIADO_PARA_ASSINATURA -> ASSINADO.
//
// `document.key` no payload é o id do recurso `document` da v3 (POST
// /envelopes/:id/documents) — testado contra o sandbox real: NÃO é o id do
// `envelope` (são recursos diferentes; a suposição inicial de que seriam o
// mesmo valor, por causa da nomenclatura da API clássica, estava errada).
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarArquivoAssinado } from "@/lib/integracoes/clicksign";

function assinaturaValida(corpoBruto: string, cabecalho: string | null): boolean {
  const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (!secret || !cabecalho) return false;

  const prefixo = "sha256=";
  if (!cabecalho.startsWith(prefixo)) return false;

  const recebido = Buffer.from(cabecalho.slice(prefixo.length), "hex");
  const esperado = Buffer.from(createHmac("sha256", secret).update(corpoBruto).digest("hex"), "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function POST(request: Request) {
  const corpoBruto = await request.text();

  if (!assinaturaValida(corpoBruto, request.headers.get("content-hmac"))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const payload = JSON.parse(corpoBruto);
  const evento: string | undefined = payload?.event?.name;
  if (evento === "sign" || evento === "refusal") {
    return registrarEventoSignatario(payload, evento);
  }
  if (evento !== "document_closed") {
    return NextResponse.json({ status: "evento ignorado" }, { status: 200 });
  }

  const documentId: string | undefined = payload.document?.key;
  if (!documentId) {
    return NextResponse.json({ error: "document.key ausente no payload." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: contrato } = await supabase
    .from("contratos")
    .select("id, pedido_id, versao, arquivo_path, clicksign_envelope_id")
    .eq("clicksign_document_id", documentId)
    .single();

  // Document que não reconhecemos (ex.: sobra de teste manual) — ignora sem erro,
  // não é motivo pra Clicksign ficar retentando a entrega.
  if (!contrato || !contrato.clicksign_envelope_id) {
    return NextResponse.json({ status: "documento não reconhecido, ignorado" }, { status: 200 });
  }

  const { data: pedido } = await supabase.from("pedidos").select("status").eq("id", contrato.pedido_id).single();
  if (pedido?.status === "assinado") {
    return NextResponse.json({ status: "já processado" }, { status: 200 });
  }

  try {
    const bufferAssinado = await buscarArquivoAssinado(contrato.clicksign_envelope_id, documentId);
    if (bufferAssinado) {
      const pathAssinado = `${contrato.pedido_id}/v${contrato.versao}-assinado.pdf`;
      await supabase.storage
        .from("contratos")
        .upload(pathAssinado, bufferAssinado, { contentType: "application/pdf", upsert: true });
      await supabase.from("contratos").update({ arquivo_assinado_path: pathAssinado }).eq("id", contrato.id);
      // A partir daqui o PDF assinado é o documento válido — o .docx original
      // some do Storage (só apaga depois de confirmar que o PDF já está salvo).
      await supabase.storage.from("contratos").remove([contrato.arquivo_path]);
    } else {
      console.error("[webhook clicksign] documento fechado sem link de arquivo assinado, seguindo sem arquivar.");
    }
  } catch (erro) {
    // Não trava a transição de status por causa de um problema secundário de
    // arquivamento — o mesmo padrão usado no stub do Bling em acoes.ts.
    console.error("[webhook clicksign] erro ao baixar/guardar arquivo assinado:", erro);
  }

  // Documento fechado = todos assinaram. Cobre signatários cujo evento `sign`
  // se perdeu (ou chegou antes de o webhook ter esse evento habilitado).
  await supabase
    .from("contrato_signatarios")
    .update({ status: "assinado", assinado_em: new Date().toISOString() })
    .eq("contrato_id", contrato.id)
    .eq("status", "pendente");

  const { error: erroTransicao } = await supabase.rpc("registrar_transicao", {
    p_pedido_id: contrato.pedido_id,
    p_para: "assinado",
    p_comentario: "Assinatura concluída na Clicksign (webhook).",
  });
  if (erroTransicao) {
    return NextResponse.json({ error: erroTransicao.message }, { status: 500 });
  }

  return NextResponse.json({ status: "processado" }, { status: 200 });
}

/**
 * Eventos `sign` (um signatário assinou) e `refusal` (recusou) — formato da
 * doc da Clicksign (/docs/evento-sign): `event.data.signer.{email,key}` e o
 * documento em `document.key`, o mesmo id que já usamos no document_closed.
 * O casamento é por documento + e-mail: o `key` do signer no webhook não tem
 * garantia de ser o mesmo id devolvido pelo POST /signers da v3 (a mesma
 * divergência já vista entre document e envelope), então só é usado como
 * desempate. Sempre responde 200 quando não reconhece — não é motivo pra
 * Clicksign ficar retentando.
 */
async function registrarEventoSignatario(payload: Record<string, unknown>, evento: "sign" | "refusal") {
  const p = payload as {
    event?: { occurred_at?: string; data?: { signer?: { email?: string; key?: string } } };
    document?: { key?: string };
  };
  const documentId = p.document?.key;
  const email = p.event?.data?.signer?.email?.trim().toLowerCase();
  const signerKey = p.event?.data?.signer?.key;
  if (!documentId || !email) {
    console.error(`[webhook clicksign] evento ${evento} sem document.key ou signer.email — ignorado.`);
    return NextResponse.json({ status: "evento sem dados suficientes, ignorado" }, { status: 200 });
  }

  const supabase = createServiceClient();
  const { data: contrato } = await supabase.from("contratos").select("id").eq("clicksign_document_id", documentId).maybeSingle();
  if (!contrato) return NextResponse.json({ status: "documento não reconhecido, ignorado" }, { status: 200 });

  const { data: candidatos } = await supabase
    .from("contrato_signatarios")
    .select("id, clicksign_signer_id, status")
    .eq("contrato_id", contrato.id)
    .eq("email", email)
    .order("ordem");
  const alvo =
    candidatos?.find((c) => c.clicksign_signer_id === signerKey) ?? candidatos?.find((c) => c.status === "pendente") ?? candidatos?.[0];
  if (!alvo) {
    // Contrato enviado antes da 0027 (sem linhas) ou e-mail alterado na Clicksign.
    console.error(`[webhook clicksign] ${evento}: signatário ${email} não encontrado no contrato ${contrato.id}.`);
    return NextResponse.json({ status: "signatário não reconhecido, ignorado" }, { status: 200 });
  }

  const { error } = await supabase
    .from("contrato_signatarios")
    .update({
      status: evento === "sign" ? "assinado" : "recusado",
      assinado_em: evento === "sign" ? (p.event?.occurred_at ?? new Date().toISOString()) : null,
    })
    .eq("id", alvo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "processado" }, { status: 200 });
}

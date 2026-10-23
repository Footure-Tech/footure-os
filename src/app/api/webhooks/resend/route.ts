import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { registrarEventoEntrega } from "@/lib/cobranca/regua";

// Eventos de entrega do Resend (entregue, atrasado, devolvido, spam) dos
// e-mails da régua de cobrança. Webhook criado no painel do Resend apontando
// para /api/webhooks/resend; o segredo de assinatura (whsec_…) fica em
// RESEND_WEBHOOK_SECRET. Assinatura no padrão Svix: HMAC-SHA256 de
// "{svix-id}.{svix-timestamp}.{corpo}" com o segredo decodificado de base64.
const TOLERANCIA_S = 5 * 60;

function assinaturaValida(request: NextRequest, corpo: string): boolean {
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const assinaturas = request.headers.get("svix-signature");
  if (!segredo || !id || !timestamp || !assinaturas) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCIA_S) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperada = Buffer.from(createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest("base64"));
  return assinaturas.split(" ").some((a) => {
    const recebida = Buffer.from(a.split(",")[1] ?? "");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

export async function POST(request: NextRequest) {
  const corpo = await request.text();
  if (!assinaturaValida(request, corpo)) return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  try {
    await registrarEventoEntrega(createServiceClient(), JSON.parse(corpo));
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[cobranca] webhook do Resend:", erro);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

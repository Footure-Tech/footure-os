import { NextResponse, type NextRequest } from "next/server";
import { exigirPapel } from "@/lib/auth/session";
import { PAPEIS_COBRANCA } from "@/lib/cobranca/permissoes";
import { createServiceClient } from "@/lib/supabase/service";
import { pdfCobrancaInter } from "@/lib/integracoes/inter";

// "Baixar boleto" da régua de cobrança: o PDF vem do Inter na hora (não fica guardado).
// Só boletos registrados em cobranca_boletos, para quem opera a régua.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  await exigirPapel(...PAPEIS_COBRANCA);
  const { codigo } = await params;
  const { data: boleto } = await createServiceClient().from("cobranca_boletos").select("codigo_solicitacao, vencimento, nosso_numero").eq("codigo_solicitacao", codigo).maybeSingle();
  if (!boleto) return NextResponse.json({ erro: "boleto não encontrado" }, { status: 404 });
  const pdf = Buffer.from(await pdfCobrancaInter(boleto.codigo_solicitacao), "base64");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="boleto-footlink-${boleto.vencimento}-${boleto.nosso_numero ?? "inter"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

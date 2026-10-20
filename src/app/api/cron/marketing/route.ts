import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sincronizarMarketing } from "@/lib/marketing/sincronizacao";
import { cronAutorizado } from "@/lib/cron/autorizacao";

// Cron diário do módulo de Marketing (vercel.json: 10:00 UTC = 07:00 BRT).
// Primeiro job agendado do sistema — modelo para os próximos: rota GET fora do
// proxy (matcher), autenticada pelo CRON_SECRET que a Vercel envia no header
// Authorization, gravando com service role.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    // Deixa ~40 s de folga antes do limite da função para fechar a auditoria.
    const resultados = await sincronizarMarketing(createServiceClient(), { origem: "cron", prazoMs: (maxDuration - 40) * 1000 });
    return NextResponse.json({ ok: true, resultados });
  } catch (erro) {
    console.error("[marketing] cron:", erro);
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

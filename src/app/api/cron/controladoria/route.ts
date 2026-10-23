import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cronAutorizado } from "@/lib/cron/autorizacao";
import { executarRotinaControladoria } from "@/lib/controladoria/rotina";

// Controladoria (vercel.json), todo dia:
//   ?turno=5h  → 08:00 UTC (5h BRT): sincroniza, avalia os alertas e envia o resumo diário à Diretoria
//   ?turno=16h → 19:00 UTC (16h BRT): sincroniza e avalia os alertas
// Horários fora das janelas do Bling (Footlink 7h/12h/18h, Academy 8h/13h/19h
// BRT): mesmo com o atraso de até ~1 h do plano Hobby, não disputam a trava de 0053.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const enviarResumo = request.nextUrl.searchParams.get("turno") === "5h";
  try {
    const resultado = await executarRotinaControladoria(createServiceClient(), { origem: "cron", enviarResumo });
    return NextResponse.json({ ok: !resultado.erroSincronizacao, ...resultado }, { status: resultado.erroSincronizacao ? 500 : 200 });
  } catch (erro) {
    console.error("[controladoria] cron:", erro);
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

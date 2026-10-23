import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cronAutorizado } from "@/lib/cron/autorizacao";
import { gerarEnviosDoDia } from "@/lib/cobranca/regua";

// Régua de cobrança (vercel.json: 12:00 UTC = 9h BRT, todo dia) — depois da
// sincronização do Bling das 7h, que no plano Hobby pode atrasar até ~1 h e
// leva ~5 min, para a régua trabalhar com as baixas mais recentes.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    const resumo = await gerarEnviosDoDia(createServiceClient());
    return NextResponse.json({ ok: true, resumo });
  } catch (erro) {
    console.error("[cobranca] cron:", erro);
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

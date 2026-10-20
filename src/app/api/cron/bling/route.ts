import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cronAutorizado } from "@/lib/cron/autorizacao";
import { executarSincronizacaoBling } from "@/lib/integracoes/blingSincronizacao";

// Cron do Bling (vercel.json: 10:00, 15:00 e 21:00 UTC = 7h, 12h e 18h BRT,
// todo dia — há vendas no fim de semana). Três jobs diários separados, não um
// "0 10,15,21": o plano Hobby da Vercel só aceita cron de uma execução por dia.
// O ?turno= só distingue os jobs (path único por job); a rota não o lê.
// O botão da sidebar continua disponível; a trava de 0053 impede os dois juntos.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    const resultado = await executarSincronizacaoBling(createServiceClient(), { origem: "cron" });
    return NextResponse.json({ ok: true, resultado });
  } catch (erro) {
    console.error("[bling] cron:", erro);
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cronAutorizado } from "@/lib/cron/autorizacao";
import { sincronizarAcademyBling, sincronizarFootlinkBling } from "@/lib/integracoes/blingSincronizacao";

// Cron do Bling, todo dia (há vendas no fim de semana), em duas etapas com
// função própria — juntas passavam do limite de 5 min (vercel.json):
//   ?etapa=footlink → 10:00, 15:00, 21:00 UTC (7h, 12h, 18h BRT)
//   ?etapa=academy  → 11:00, 16:00, 22:00 UTC (8h, 13h, 19h BRT)
// Uma hora de distância porque o plano Hobby pode atrasar o cron em até ~1 h:
// assim as etapas não disputam a trava de 0053. Um job por horário (o Hobby
// só aceita uma execução por dia por job); ?turno= só distingue os paths.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const etapa = request.nextUrl.searchParams.get("etapa") === "academy" ? "academy" : "footlink";
  try {
    const servico = createServiceClient();
    const resultado = etapa === "academy" ? await sincronizarAcademyBling(servico, { origem: "cron" }) : await sincronizarFootlinkBling(servico, { origem: "cron" });
    return NextResponse.json({ ok: true, etapa, resultado });
  } catch (erro) {
    console.error(`[bling] cron (${etapa}):`, erro);
    return NextResponse.json({ ok: false, etapa, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { atualizarBoleto } from "@/lib/cobranca/boletos";
import { baixarBoletosPagos } from "@/lib/cobranca/baixaBling";

// Avisos da API Cobrança do Banco Inter (pagamento, cancelamento, expiração).
// O Inter não assina os avisos: o endereço registrado leva uma chave secreta
// (?chave=, variável INTER_WEBHOOK_SEGREDO) e o conteúdo nunca é tomado como
// verdade — o aviso só dispara a releitura da cobrança na API (atualizarBoleto).
// Cada aviso fica gravado em cobranca_inter_eventos para auditoria. Cobranças
// que não estão em cobranca_boletos (emitidas à mão no Inter) são ignoradas.
export const maxDuration = 60;

function chaveValida(request: NextRequest) {
  const segredo = process.env.INTER_WEBHOOK_SEGREDO;
  const recebida = request.nextUrl.searchParams.get("chave") ?? "";
  if (!segredo) return false;
  const a = Buffer.from(recebida), b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** codigoSolicitacao de cada cobrança do aviso (o Inter manda uma lista; aceita também um objeto só). */
function codigosDoAviso(corpo: unknown): string[] {
  const lista = Array.isArray(corpo) ? corpo : [corpo];
  return [
    ...new Set(
      lista
        .map((x) => (x as { codigoSolicitacao?: string; cobranca?: { codigoSolicitacao?: string } })?.codigoSolicitacao ?? (x as { cobranca?: { codigoSolicitacao?: string } })?.cobranca?.codigoSolicitacao)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    ),
  ];
}

export async function POST(request: NextRequest) {
  if (!chaveValida(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const supabase = createServiceClient();
  let corpo: unknown = null;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }
  const { data: evento } = await supabase.from("cobranca_inter_eventos").insert({ payload: corpo }).select("id").single();

  const codigos = codigosDoAviso(corpo);
  const { data: nossos } = codigos.length ? await supabase.from("cobranca_boletos").select("codigo_solicitacao").in("codigo_solicitacao", codigos) : { data: [] };
  const falhas: string[] = [];
  for (const { codigo_solicitacao } of nossos ?? []) {
    try {
      await atualizarBoleto(supabase, codigo_solicitacao);
    } catch (e) {
      falhas.push(`${codigo_solicitacao}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Pagamento confirmado: baixa no Bling já (o que falhar, a conferência das 9h tenta de novo).
  if ((nossos ?? []).length) await baixarBoletosPagos(supabase).catch((e) => falhas.push(`baixa no Bling: ${e instanceof Error ? e.message : String(e)}`));
  if (evento) await supabase.from("cobranca_inter_eventos").update({ processado: falhas.length === 0, erro: falhas.join(" | ") || null }).eq("id", evento.id);
  // 200 mesmo com falha pontual: a conferência diária relê os boletos em aberto.
  return NextResponse.json({ ok: true, atualizados: (nossos ?? []).length - falhas.length });
}

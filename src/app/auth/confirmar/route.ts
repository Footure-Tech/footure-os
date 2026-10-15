// Destino do link do e-mail de redefinição de senha. Troca o token_hash por
// uma sessão (verifyOtp grava os cookies via o client do servidor) e segue
// para `next` (só caminhos internos — evita open redirect). Link inválido ou
// expirado volta ao login com aviso.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (tokenHash && tipo === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
    console.error("[auth/confirmar] verifyOtp:", error.message);
  }
  return NextResponse.redirect(new URL("/login?aviso=link_invalido", request.url));
}

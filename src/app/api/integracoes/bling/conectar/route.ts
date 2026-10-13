// Fase 2 — dispara o fluxo OAuth do Bling. Só admin; gera um `state`
// aleatório (proteção CSRF, comparado de volta no callback) e redireciona
// pra tela de login/autorização do Bling.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { exigirPapel } from "@/lib/auth/session";
import { gerarUrlAutorizacaoBling } from "@/lib/integracoes/bling";

export async function GET() {
  await exigirPapel("admin");

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("bling_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(gerarUrlAutorizacaoBling(state));
}

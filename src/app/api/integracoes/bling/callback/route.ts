// Fase 2 — callback do OAuth do Bling. Compara o `state` recebido com o
// salvo no cookie (CSRF), troca o `code` pelos tokens e guarda em
// integracoes_bling. Redireciona de volta pra tela de configurações com um
// indicador de resultado (?bling=conectado|erro|erro_state).
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { trocarCodigoPorToken } from "@/lib/integracoes/bling";

export async function GET(request: Request) {
  await exigirPapel("admin");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const stateEsperado = cookieStore.get("bling_oauth_state")?.value;
  cookieStore.delete("bling_oauth_state");

  if (!code || !state || !stateEsperado || state !== stateEsperado) {
    return NextResponse.redirect(new URL("/admin/configuracoes?bling=erro_state", request.url));
  }

  try {
    const supabase = await createClient();
    await trocarCodigoPorToken(supabase, code);
  } catch (erro) {
    console.error("[bling callback] falha ao trocar code por token:", erro);
    return NextResponse.redirect(new URL("/admin/configuracoes?bling=erro", request.url));
  }

  return NextResponse.redirect(new URL("/admin/configuracoes?bling=conectado", request.url));
}

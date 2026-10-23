import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const AREA_POR_PAPEL: Record<string, string> = {
  vendedor: "/vendedor",
  juridico: "/juridico",
  admin: "/dashboard",
  marketing: "/marketing",
  financeiro: "/financeiro/cobranca",
};

// Sem sessão: login e "esqueci minha senha". Quem já está logado e abre uma
// delas é mandado pra própria área.
const ROTAS_PUBLICAS = ["/login", "/esqueci-senha"];
// Abertas com ou sem sessão: /auth/confirmar troca o token do e-mail por
// sessão (o usuário pode até já ter outra sessão aberta no navegador).
const ROTAS_ABERTAS = ["/auth/"];

// Chamado pelo src/proxy.ts em toda request. Faz duas coisas:
// 1. Refresh de sessão (padrão @supabase/ssr) — checagem "otimista", sem
//    consulta pesada além do necessário para validar o token.
// 2. Redireciona quem não está logado para /login, e quem está logado na
//    área errada (ex.: vendedor tentando abrir /admin) para a sua própria
//    área — mas isso é só UX; a autorização de verdade (RLS + checagem
//    dentro de cada Server Action) é a camada que realmente protege dados.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const rotaPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));
  if (ROTAS_ABERTAS.some((rota) => pathname.startsWith(rota))) return response;

  // Sem projeto Supabase conectado (.env.local ausente/incompleto): não dá
  // pra checar sessão de verdade. Em vez de deixar createServerClient
  // lançar e derrubar a request com 500, trata como "ninguém logado" — só
  // /login (e as demais rotas públicas) renderiza; o resto redireciona pra
  // lá, igual ao caso normal de usuário deslogado.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!rotaPublica) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && rotaPublica) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("papel")
      .eq("user_id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile ? AREA_POR_PAPEL[profile.papel] : "/vendedor";
    return NextResponse.redirect(url);
  }

  return response;
}

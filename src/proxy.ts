import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renomeou middleware.ts -> proxy.ts (export `proxy`, não mais
// `middleware`). Ver AGENTS.md / node_modules/next/dist/docs para o resto das
// mudanças de convenção desta versão.
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto assets estáticos, webhooks (Clicksign) e crons da
     * Vercel (api/cron, autenticados pelo CRON_SECRET) — não têm sessão de
     * usuário para refrescar e não devem ser redirecionados para /login.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

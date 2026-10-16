import Link from "next/link";
import type { SessaoUsuario } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

// AppBar do handoff: 60px, preta fixa nos dois temas (identidade Footure),
// com o logotipo Footure em branco (public/brand). Sem campo de
// busca e sem sino de notificações (não há backend pra nenhum dos dois) e
// sem seletor de perfil — o perfil é o papel do usuário logado.
export function AppBar({ sessao }: { sessao: SessaoUsuario }) {
  return (
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-5 bg-appbar pr-6 pl-5 text-white">
      <Link href="/" className="flex shrink-0 items-center rounded-lg focus-visible:shadow-focus focus-visible:outline-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização necessária */}
        <img src="/brand/logo-footure-branco.svg" alt="Footure Football Company" width={73} height={28} className="h-7 w-auto" />
      </Link>
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu sessao={sessao} />
    </header>
  );
}

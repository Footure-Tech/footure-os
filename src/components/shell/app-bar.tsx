import Link from "next/link";
import type { SessaoUsuario } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import type { ContextoDados } from "@/lib/contexto/contexto";
import { SeletorContexto } from "@/components/shell/seletor-contexto";

// AppBar do handoff: 60px, preta fixa nos dois temas (identidade Footure),
// com o logotipo Footure em branco (public/brand). Sem campo de
// busca e sem sino de notificações (não há backend pra nenhum dos dois) e
// sem seletor de perfil — o perfil é o papel do usuário logado. O seletor
// Footlink | Academy define o contexto dos dados das telas.
export function AppBar({ sessao, contexto }: { sessao: SessaoUsuario; /** null = papel sem seletor (jurídico). */ contexto: ContextoDados | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-5 bg-appbar pr-6 text-white">
      {/* O seletor alinha com a borda esquerda do conteúdo: área do logo = largura
          da sidebar (248px no desktop) + o mesmo respiro do <main> (30px). */}
      <div className="flex shrink-0 items-center">
        <div className="flex shrink-0 items-center pl-5 lg:w-[248px]">
          <Link href="/" className="flex shrink-0 items-center rounded-lg focus-visible:shadow-focus focus-visible:outline-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização necessária */}
            <img src="/brand/logo-footure-branco.svg" alt="Footure Football Company" width={73} height={28} className="h-7 w-auto" />
          </Link>
        </div>
        {contexto && (
          <div className="ml-5 lg:ml-[30px]">
            <SeletorContexto contexto={contexto} />
          </div>
        )}
      </div>
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu sessao={sessao} />
    </header>
  );
}

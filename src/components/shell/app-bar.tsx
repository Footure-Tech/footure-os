import Link from "next/link";
import type { SessaoUsuario } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

// Marca do handoff (prototype/assets/footlink-mark.svg) — não há marca
// Footure separada no codebase (public/logo.svg é o logotipo Footlink com
// texto, largo demais pra AppBar). Inline pra herdar o branco via currentColor.
function MarcaFooture() {
  return (
    <svg viewBox="0 0 30 30" fill="none" aria-hidden className="size-7 shrink-0">
      <path
        d="M15 1.2C7.37935 1.2 1.19995 7.3788 1.19995 15C1.19995 22.6212 7.37935 28.8 15 28.8C22.6206 28.8 28.8 22.6212 28.8 15C28.8 7.3788 22.6206 1.2 15 1.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.226 20.8314L8.88062 13.5942L15.0156 9.1218L21.1518 13.5942L18.8088 20.8314H11.226Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// AppBar do handoff: 60px, roxo fixo nos dois temas. Sem campo de busca e sem
// sino de notificações (não há backend pra nenhum dos dois) e sem seletor de
// perfil — o perfil é o papel do usuário logado.
export function AppBar({ sessao }: { sessao: SessaoUsuario }) {
  return (
    <header className="sticky top-0 z-[1000] flex h-[60px] shrink-0 items-center gap-5 bg-appbar pr-6 pl-5 text-white">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:shadow-focus focus-visible:outline-none">
        <MarcaFooture />
        <span className="flex flex-col leading-[1.05]">
          <span className="text-lg font-extrabold tracking-[-0.01em]">footure</span>
          <span className="text-[10px] font-bold tracking-[0.12em] opacity-75">GESTÃO</span>
        </span>
      </Link>
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu sessao={sessao} />
    </header>
  );
}

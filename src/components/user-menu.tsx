"use client";

import Link from "next/link";
import { MdPerson, MdLogout } from "react-icons/md";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sair } from "@/lib/auth/actions";
import { ROTULO_PERFIL } from "@/lib/auth/perfis";
import type { SessaoUsuario } from "@/lib/auth/session";
import { iniciais } from "@/components/ds/avatar";

// Avatar da AppBar (círculo branco 30px, iniciais roxas) — abre o menu do usuário.
export function UserMenu({ sessao }: { sessao: SessaoUsuario }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={sessao.nome}
        aria-label={`Menu de ${sessao.nome}`}
        className="flex shrink-0 items-center rounded-[20px] bg-white/10 p-1 transition-all duration-200 hover:bg-white/20 focus-visible:shadow-focus focus-visible:outline-none"
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-white text-xs font-extrabold text-lightPurple1">
          {iniciais(sessao.nome)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-bold text-foreground">{sessao.nome}</span>
            <span className="text-xs font-normal text-muted-foreground">{ROTULO_PERFIL[sessao.papel]}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href="/perfil" />}>
          <MdPerson className="size-4" />
          Ver perfil
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => sair()}>
          <MdLogout className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

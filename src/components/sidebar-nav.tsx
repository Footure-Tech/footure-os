"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileCheck2,
  CheckSquare,
  Users,
  Settings,
  Building2,
  FilePlus2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PapelUsuario } from "@/lib/supabase/database.types";

interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Ativo também quando a rota atual é uma sub-rota deste link (ex.: /vendedor/novo). */
  exact?: boolean;
}

interface SidebarGroup {
  label: string;
  links: SidebarLink[];
}

// Componentes de ícone (lucide-react) não são serializáveis pela fronteira
// Server->Client — por isso essa config, com os ícones, mora dentro do
// próprio client component em vez de vir como prop do AppShell (Server
// Component). AppShell só passa o papel (string).
const GRUPOS_POR_PAPEL: Record<PapelUsuario, SidebarGroup[]> = {
  vendedor: [
    {
      label: "Vendas",
      links: [
        { href: "/vendedor", label: "Meus pedidos", icon: ClipboardList, exact: true },
        { href: "/clientes", label: "Clientes", icon: Building2 },
        { href: "/inadimplencia", label: "Inadimplência", icon: AlertTriangle, exact: true },
      ],
    },
  ],
  juridico: [
    {
      label: "Jurídico",
      links: [{ href: "/juridico", label: "Contratos para revisão", icon: FileCheck2, exact: true }],
    },
  ],
  admin: [
    {
      label: "Administração",
      links: [
        { href: "/admin", label: "Aprovação", icon: CheckSquare, exact: true },
        { href: "/vendedor/novo", label: "Novo pedido", icon: FilePlus2 },
        { href: "/clientes", label: "Clientes", icon: Building2 },
        { href: "/inadimplencia", label: "Inadimplência", icon: AlertTriangle, exact: true },
        { href: "/admin/usuarios", label: "Usuários", icon: Users, exact: true },
        { href: "/admin/configuracoes", label: "Configurações", icon: Settings, exact: true },
      ],
    },
  ],
};

// Porte de .ds-sidenav (design_system.html) — fundo roxo quase-preto,
// indicador de item ativo com borda + fundo translúcido roxo.
export function SidebarNav({ papel }: { papel: PapelUsuario }) {
  const pathname = usePathname();
  const groups = GRUPOS_POR_PAPEL[papel];

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[230px] shrink-0 flex-col overflow-y-auto border-r border-white/6 bg-[#09001a]">
      <div className="flex items-center border-b border-white/6 px-5 py-6">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização necessária */}
          <img src="/logo.svg" alt="Footlink" height={28} className="h-7 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-5 pt-4 pb-1.5 text-[10px] font-bold tracking-[0.12em] text-white/25 uppercase">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5 px-3">
              {group.links.map((link) => {
                const ativo = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-3 py-2 text-[13px] font-medium text-white/55 transition-all hover:bg-white/5 hover:text-white",
                        ativo && "border-primary bg-primary/20 font-bold text-white",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={2} />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

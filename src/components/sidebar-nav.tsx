"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import { MdBusiness, MdDashboard, MdDescription, MdGavel, MdHistoryEdu, MdPayments, MdManageAccounts, MdReceipt, MdSettings, MdTrendingUp, MdWarning } from "react-icons/md";
import { cn } from "@/lib/utils";
import { SincronizarBlingButton } from "@/components/clientes/sincronizar-bling-button";
import type { PapelUsuario } from "@/lib/supabase/database.types";
import type { ChaveContador } from "@/lib/shell/dadosShell";

interface SidebarLink {
  href: string;
  label: string;
  icon: IconType;
  /** Cor da caixa do ícone (token de módulo do Footlink DS). */
  cor: string;
  contador?: ChaveContador;
  /** Ativo também quando a rota atual é uma sub-rota deste link (ex.: /vendedor/novo). */
  exact?: boolean;
  /** Prefixos de rota que também marcam o link como ativo (ex.: o detalhe
   * /pedidos/[id] destaca a lista de onde o usuário veio). */
  ativoEm?: string[];
}

interface SidebarGroup {
  label: string;
  links: SidebarLink[];
}

export interface IntegracaoSidebar {
  nome: string;
  ok: boolean;
  status: string;
}

const PEDIDOS_VENDEDOR: SidebarLink = {
  href: "/vendedor",
  label: "Pedidos de venda",
  icon: MdReceipt,
  cor: "bg-iconGreen",
  contador: "pedidosRascunho",
  exact: true,
  ativoEm: ["/vendedor/", "/pedidos/"],
};
const PEDIDOS_ADMIN: SidebarLink = {
  ...PEDIDOS_VENDEDOR,
  href: "/admin",
  contador: "aprovacao",
};
const CLIENTES: SidebarLink = { href: "/clientes", label: "Clientes", icon: MdBusiness, cor: "bg-iconBlue" };
const VENDAS: SidebarLink = { href: "/vendas", label: "Vendas", icon: MdTrendingUp, cor: "bg-iconPurple", exact: true };
const CONTRATOS: SidebarLink = {
  href: "/juridico",
  label: "Assinatura de contratos",
  icon: MdGavel,
  cor: "bg-iconPurple",
  contador: "contratos",
  exact: true,
};
const HISTORICO_MODELO: SidebarLink = { href: "/juridico/historico", label: "Histórico do modelo", icon: MdHistoryEdu, cor: "bg-iconGray", exact: true };
const CONTRATOS_FINANCEIRO: SidebarLink = {
  href: "/financeiro",
  label: "Contratos",
  icon: MdDescription,
  cor: "bg-iconYellow",
  exact: true,
  ativoEm: ["/financeiro/contratos/"],
};
const PAGAMENTOS: SidebarLink = {
  href: "/financeiro/pagamentos",
  label: "Pagamentos",
  icon: MdPayments,
  cor: "bg-iconGreen",
  exact: true,
};
const INADIMPLENCIA: SidebarLink = {
  href: "/inadimplencia",
  label: "Inadimplência",
  icon: MdWarning,
  cor: "bg-iconRed",
  contador: "inadimplentes",
  exact: true,
};

// Seções por módulo (handoff), limitadas às rotas que cada papel já acessa
// hoje (layouts com exigirPapel). Componentes de ícone não são serializáveis
// pela fronteira Server->Client — por isso a config mora no client component
// e o AppShell só passa o papel.
const GRUPOS_POR_PAPEL: Record<PapelUsuario, SidebarGroup[]> = {
  vendedor: [
    { label: "Comercial", links: [PEDIDOS_VENDEDOR, CLIENTES] },
    { label: "Financeiro", links: [INADIMPLENCIA] },
  ],
  juridico: [{ label: "Jurídico", links: [{ ...CONTRATOS, ativoEm: ["/pedidos/"] }, HISTORICO_MODELO] }],
  admin: [
    { label: "Gestão", links: [{ href: "/dashboard", label: "Dashboard", icon: MdDashboard, cor: "bg-iconPurple", exact: true }] },
    {
      label: "Comercial",
      links: [PEDIDOS_ADMIN, VENDAS, CLIENTES],
    },
    { label: "Jurídico", links: [CONTRATOS, HISTORICO_MODELO] },
    { label: "Financeiro", links: [CONTRATOS_FINANCEIRO, PAGAMENTOS, INADIMPLENCIA] },
    {
      label: "Administração",
      links: [
        { href: "/admin/usuarios", label: "Usuários", icon: MdManageAccounts, cor: "bg-iconGray", exact: true },
        { href: "/admin/configuracoes", label: "Configurações", icon: MdSettings, cor: "bg-iconGray", exact: true },
      ],
    },
  ],
};

// Sidebar do handoff (248px, superfície clara, ícone em caixa colorida).
// Abaixo de 1024px vira um trilho de 72px só com ícones (rótulo no title) —
// o handoff não define o comportamento estreito, e 248px fixos espremeriam
// o conteúdo em ~900px.
export function SidebarNav({
  papel,
  contadores,
  integracoes,
}: {
  papel: PapelUsuario;
  contadores: Partial<Record<ChaveContador, number>>;
  integracoes: IntegracaoSidebar[];
}) {
  const pathname = usePathname();
  const groups = GRUPOS_POR_PAPEL[papel];
  // Mesmos papéis da action de sincronização (sincronizarContatosBlingAction).
  const podeSincronizar = papel === "vendedor" || papel === "admin";

  return (
    <aside className="sticky top-[60px] flex h-[calc(100vh-60px)] w-[72px] shrink-0 flex-col border-r border-gray5 bg-surface py-5 transition-colors duration-300 lg:w-[248px]">
      <nav className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto pb-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="hidden px-6 pb-1.5 text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase lg:block">{group.label}</span>
            {group.links.map((link) => {
              const ativo =
                (link.exact ? pathname === link.href : pathname.startsWith(link.href)) ||
                !!link.ativoEm?.some((prefixo) => pathname.startsWith(prefixo));
              const Icon = link.icon;
              const contagem = link.contador ? (contadores[link.contador] ?? 0) : 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "relative mx-2 flex items-center justify-center gap-3 rounded-lg border-l-[3px] border-transparent py-[9px] text-sm font-semibold text-darkPurple1 transition-all duration-200 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none lg:mx-3 lg:justify-start lg:pr-3 lg:pl-[9px]",
                    ativo && "border-lightPurple1 bg-nav-active text-nav-active-foreground hover:bg-nav-active",
                  )}
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-white", link.cor)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="hidden flex-1 lg:inline">{link.label}</span>
                  {contagem > 0 && (
                    <span
                      className={cn(
                        "flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-lightPurple1 px-1.5 text-[10px] font-extrabold text-white",
                        // No trilho estreito o contador vira um selo sobre o ícone.
                        "absolute -top-0.5 right-1 lg:static",
                      )}
                    >
                      {contagem}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mx-5 hidden shrink-0 flex-col gap-2.5 rounded-[10px] border border-gray5 p-3.5 lg:flex">
        <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Integrações</span>
        {integracoes.map((integracao) => (
          <div key={integracao.nome} className="flex items-center gap-2 text-[13px]">
            <span className={cn("size-2 shrink-0 rounded-full", integracao.ok ? "bg-green2" : "bg-gray3")} />
            <span className="flex-1 font-semibold text-darkPurple1">{integracao.nome}</span>
            <span className="text-xs text-gray3">{integracao.status}</span>
          </div>
        ))}
        {podeSincronizar && <SincronizarBlingButton />}
      </div>
      {/* Trilho estreito: o card de integrações some, fica só o atalho. */}
      {podeSincronizar && (
        <div className="lg:hidden">
          <SincronizarBlingButton variante="icone" />
        </div>
      )}
    </aside>
  );
}

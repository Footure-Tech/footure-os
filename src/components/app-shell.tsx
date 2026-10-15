import type { ReactNode } from "react";
import type { SessaoUsuario } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { obterDadosShell } from "@/lib/shell/dadosShell";
import { tempoDecorrido } from "@/lib/formatacao";
import { AppBar } from "@/components/shell/app-bar";
import { SidebarNav, type IntegracaoSidebar } from "@/components/sidebar-nav";
import { TransicaoTela } from "@/components/shell/transicao-tela";

// App shell do handoff: AppBar roxa no topo, sidebar por módulo e conteúdo
// com padding de 30px. Contadores e integrações vêm de consultas reais
// (obterDadosShell) — atualizam quando uma Server Action revalida a rota.
export async function AppShell({ sessao, children }: { sessao: SessaoUsuario; children: ReactNode }) {
  const supabase = await createClient();
  const { contadores, integracoes } = await obterDadosShell(supabase, sessao.papel, sessao.id);

  const statusIntegracoes: IntegracaoSidebar[] = [
    {
      nome: "Clicksign",
      ok: integracoes.clicksignConfigurada,
      status: integracoes.clicksignConfigurada ? "Conectado" : "Não configurado",
    },
    {
      nome: "Bling",
      ok: !!integracoes.blingSincronizadoEm,
      status: integracoes.blingSincronizadoEm ? tempoDecorrido(integracoes.blingSincronizadoEm) : "Nunca sincronizado",
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-background">
      <AppBar sessao={sessao} />
      <div className="flex flex-1 items-start">
        <SidebarNav papel={sessao.papel} contadores={contadores} integracoes={statusIntegracoes} />
        <main className="min-w-0 flex-1 p-[30px]">
          <div className="max-w-[1500px]">
            <TransicaoTela>{children}</TransicaoTela>
          </div>
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { MdLock } from "react-icons/md";
import type { SessaoUsuario } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { obterDadosShell, type StatusIntegracoes } from "@/lib/shell/dadosShell";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { tempoDecorrido } from "@/lib/formatacao";
import { AppBar } from "@/components/shell/app-bar";
import { SidebarNav, type IntegracaoSidebar } from "@/components/sidebar-nav";
import { TransicaoTela } from "@/components/shell/transicao-tela";

// Bling: sincroniza por cron (7h, 12h, 18h) e pelo botão; a última execução
// registrada (0053) diz se está rodando ou se falhou.
function statusBling({ blingSincronizadoEm, blingUltimaExecucao: execucao }: StatusIntegracoes): IntegracaoSidebar {
  if (execucao?.status === "rodando") return { nome: "Bling", ok: true, status: "Sincronizando…" };
  if (execucao?.status === "erro") {
    return { nome: "Bling", ok: false, falhou: true, status: `Falhou ${tempoDecorrido(execucao.iniciadoEm)}`, detalhe: execucao.erro ?? undefined };
  }
  return {
    nome: "Bling",
    ok: !!blingSincronizadoEm,
    status: blingSincronizadoEm ? tempoDecorrido(blingSincronizadoEm) : "Nunca sincronizado",
  };
}

// App shell do handoff: AppBar roxa no topo, sidebar por módulo e conteúdo
// com padding de 30px. Contadores e integrações vêm de consultas reais
// (obterDadosShell) — atualizam quando uma Server Action revalida a rota.
export async function AppShell({ sessao, children }: { sessao: SessaoUsuario; children: ReactNode }) {
  const supabase = await createClient();
  const [{ contadores, integracoes }, contextoCookie] = await Promise.all([obterDadosShell(supabase, sessao.papel, sessao.id), lerContextoDados()]);
  // Jurídico só trabalha com o Footlink (contratos): sem seletor de contexto.
  const comContexto = sessao.papel === "admin" || sessao.papel === "vendedor";
  const contexto = comContexto ? contextoCookie : "footlink";

  const statusIntegracoes: IntegracaoSidebar[] = [
    {
      nome: "Clicksign",
      ok: integracoes.clicksignConfigurada,
      status: integracoes.clicksignConfigurada ? "Conectado" : "Não configurado",
    },
    statusBling(integracoes),
  ];
  const blingSincronizando = integracoes.blingUltimaExecucao?.status === "rodando";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <AppBar sessao={sessao} contexto={comContexto ? contexto : null} />
      <div className="flex flex-1 items-start">
        <SidebarNav papel={sessao.papel} contexto={contexto} contadores={contadores} integracoes={statusIntegracoes} blingSincronizando={blingSincronizando} />
        <main className="min-w-0 flex-1 p-[30px]">
          <div className="max-w-[1500px]">
            {sessao.senhaTemporaria && (
              // Até o usuário trocar a senha temporária do e-mail de acesso.
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-orange/40 bg-orange3 px-5 py-3 text-sm text-[#ce9232]">
                <MdLock className="size-5 shrink-0" />
                <span className="flex-1 font-semibold">Você está usando uma senha temporária. Defina uma senha pessoal para proteger sua conta.</span>
                <Link href="/perfil#senha" className="font-bold underline">
                  Alterar senha
                </Link>
              </div>
            )}
            <TransicaoTela>{children}</TransicaoTela>
          </div>
        </main>
      </div>
    </div>
  );
}

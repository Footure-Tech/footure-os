import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Financeiro: Diretoria (admin), comercial (vendedor) e o perfil Financeiro
// consultam; editar dados do contrato e anexar arquivos continua só com a
// Diretoria (ver as páginas); a régua de cobrança é da Diretoria e do Financeiro.
export default async function FinanceiroLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "vendedor", "financeiro");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

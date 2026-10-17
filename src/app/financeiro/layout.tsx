import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Financeiro: Diretoria (admin) e comercial (vendedor) consultam; editar dados do
// contrato e anexar arquivos continua só com a Diretoria (ver as páginas).
export default async function FinanceiroLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "vendedor");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

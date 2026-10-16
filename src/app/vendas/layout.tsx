import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Vendas mostra valores de todos os contratos — fica com a Diretoria (admin), como o Financeiro.
export default async function VendasLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Vendas: Diretoria (admin) e comercial (vendedor), como o Financeiro.
export default async function VendasLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "vendedor");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

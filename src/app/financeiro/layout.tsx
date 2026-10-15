import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Financeiro fica sob a Diretoria (admin) — não há papel "financeiro" (decisão de produto).
export default async function FinanceiroLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

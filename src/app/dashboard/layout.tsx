import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Dashboard é da Diretoria (admin).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

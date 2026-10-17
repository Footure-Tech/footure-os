import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Dashboard: Diretoria (admin) e comercial (vendedor). Para o vendedor, os
// dados de pedidos da plataforma seguem o RLS (só os dele); os do Bling são gerais.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "vendedor");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

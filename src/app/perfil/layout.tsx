import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

export default async function PerfilLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("vendedor", "juridico", "admin", "marketing", "financeiro");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

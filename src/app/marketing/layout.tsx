import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Marketing: Diretoria e o perfil Marketing (0051), que só enxerga este módulo.
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "marketing");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

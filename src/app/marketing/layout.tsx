import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Marketing: Diretoria, o perfil Marketing (0051), que só enxerga este módulo,
// e o Vendedor (0057), com o mesmo acesso do Marketing.
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin", "marketing", "vendedor");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

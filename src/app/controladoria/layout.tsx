import type { ReactNode } from "react";
import { exigirPapel } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

// Controladoria (visão do CFO, 0061): só Diretoria (decisão de 22/10).
export default async function ControladoriaLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirPapel("admin");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}

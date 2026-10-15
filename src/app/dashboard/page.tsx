import { createClient } from "@/lib/supabase/server";
import { carregarDashboard, type Periodo } from "@/lib/dashboard/indicadores";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaDashboard, type LayoutDashboard } from "@/components/dashboard/tela-dashboard";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { periodo: p, layout: l } = await searchParams;
  const periodo: Periodo = p === "tri" || p === "12m" ? p : "mes";
  const layout: LayoutDashboard = l === "fluxo" ? "fluxo" : "geral";
  const supabase = await createClient();
  const dados = await carregarDashboard(supabase, periodo);
  return <TelaDashboard dados={dados} periodo={periodo} layout={layout} urlLogo={(path) => urlLogoCliente(supabase, path)} />;
}

import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { carregarDashboard, type Periodo } from "@/lib/dashboard/indicadores";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaDashboard, type LayoutDashboard } from "@/components/dashboard/tela-dashboard";

/** Para o vendedor, links de telas da Diretoria/Jurídico (/admin, /juridico) levam aos pedidos dele. */
const paraVendedor = (href: string) => (href.startsWith("/admin") || href.startsWith("/juridico") ? "/vendedor" : href);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sessao = await exigirPapel("admin", "vendedor");
  const { periodo: p, layout: l } = await searchParams;
  const periodo: Periodo = p === "tri" || p === "12m" ? p : "mes";
  const layout: LayoutDashboard = l === "fluxo" ? "fluxo" : "geral";
  const supabase = await createClient();
  const carregado = await carregarDashboard(supabase, periodo);
  const dados =
    sessao.papel === "vendedor"
      ? {
          ...carregado,
          fluxo: carregado.fluxo.map((b) => ({ ...b, href: paraVendedor(b.href) })),
          pontos: carregado.pontos.map((pt) => ({ ...pt, href: paraVendedor(pt.href) })),
        }
      : carregado;
  return <TelaDashboard dados={dados} periodo={periodo} layout={layout} urlLogo={(path) => urlLogoCliente(supabase, path)} />;
}

import { createClient } from "@/lib/supabase/server";
import { carregarContratos, type FiltroContratos } from "@/lib/financeiro/carteira";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaContratos } from "@/components/financeiro/tela-contratos";

const FILTROS: FiltroContratos[] = ["ativos", "vencem_3_meses", "inativos", "cancelados"];

// Financeiro · Contratos (pedidos de venda do Bling). Lê só o cache do Bling.
export default async function ContratosFinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  const { filtro: f } = await searchParams;
  const filtro = FILTROS.includes(f as FiltroContratos) ? (f as FiltroContratos) : "ativos";
  const supabase = await createClient();
  const dados = await carregarContratos(supabase);
  return <TelaContratos dados={dados} filtro={filtro} urlLogo={(path) => urlLogoCliente(supabase, path)} />;
}

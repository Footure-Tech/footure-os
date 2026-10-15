import { createClient } from "@/lib/supabase/server";
import { carregarCarteira } from "@/lib/financeiro/carteira";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaFinanceiro } from "@/components/financeiro/tela-financeiro";

// Lê só o cache do Bling (gravado em "Sincronizar") — sem chamadas ao Bling
// na renderização. A carteira é por cliente: ainda não há vínculo pedido -> Bling.
export default async function FinanceiroPage() {
  const supabase = await createClient();
  const dados = await carregarCarteira(supabase);
  return <TelaFinanceiro dados={dados} urlLogo={(path) => urlLogoCliente(supabase, path)} />;
}

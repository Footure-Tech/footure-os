import { createClient } from "@/lib/supabase/server";
import { carregarTelaPagar } from "@/lib/controladoria/consultas";
import { TelaPagar } from "@/components/controladoria/tela-pagar";

// Controladoria · Contas a pagar (0061). Lê só o cache do Bling.
export default async function ContasAPagarPage() {
  const dados = await carregarTelaPagar(await createClient());
  return <TelaPagar dados={dados} />;
}

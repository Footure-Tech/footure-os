import { createClient } from "@/lib/supabase/server";
import { carregarTelaPremissas } from "@/lib/controladoria/consultas";
import { TelaPremissas } from "@/components/controladoria/tela-premissas";

// Controladoria · Premissas (0061): saldos, camadas das contas e limites dos alertas.
export default async function PremissasPage() {
  const dados = await carregarTelaPremissas(await createClient());
  return <TelaPremissas dados={dados} />;
}

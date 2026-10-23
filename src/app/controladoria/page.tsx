import { createClient } from "@/lib/supabase/server";
import { carregarPainel } from "@/lib/controladoria/consultas";
import { TelaPainel } from "@/components/controladoria/tela-painel";

// "Atualizar dados do Bling" roda a sincronização financeira inteira — pode levar alguns minutos.
export const maxDuration = 300;

// Controladoria · Painel do CFO (0061). Lê só o cache do Bling.
export default async function ControladoriaPage() {
  const dados = await carregarPainel(await createClient());
  return <TelaPainel dados={dados} />;
}

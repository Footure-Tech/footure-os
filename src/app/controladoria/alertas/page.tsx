import { createClient } from "@/lib/supabase/server";
import { carregarTelaAlertas, type AbaAlertas } from "@/lib/controladoria/consultas";
import { TelaAlertas } from "@/components/controladoria/tela-alertas";

const ABAS: AbaAlertas[] = ["abertos", "adiados", "encerrados", "resolvidos"];

// "Atualizar dados do Bling" roda a sincronização financeira inteira — pode levar alguns minutos.
export const maxDuration = 300;

// Controladoria · Alertas (0061).
export default async function AlertasPage({ searchParams }: PageProps<"/controladoria/alertas">) {
  const { aba: a } = await searchParams;
  const aba = ABAS.includes(a as AbaAlertas) ? (a as AbaAlertas) : "abertos";
  const dados = await carregarTelaAlertas(await createClient(), aba);
  return <TelaAlertas dados={dados} aba={aba} />;
}

import { createClient } from "@/lib/supabase/server";
import { carregarTelaDre } from "@/lib/controladoria/consultas";
import type { RegimeDre } from "@/lib/controladoria/dre";
import { TelaDre } from "@/components/controladoria/tela-dre";

// Controladoria · DRE gerencial (0061). Lê só o cache do Bling.
export default async function DrePage({ searchParams }: PageProps<"/controladoria/dre">) {
  const { regime: r } = await searchParams;
  const regime: RegimeDre = r === "caixa" ? "caixa" : "competencia";
  const dados = await carregarTelaDre(await createClient(), regime);
  return <TelaDre dados={dados} regime={regime} />;
}

import { createClient } from "@/lib/supabase/server";
import { carregarTelaCaixa } from "@/lib/controladoria/consultas";
import type { CenarioCaixa } from "@/lib/controladoria/fluxoCaixa";
import { TelaCaixa } from "@/components/controladoria/tela-caixa";

// Controladoria · Caixa (0061): fluxo mensal e 13 semanas. Lê só o cache do Bling.
export default async function CaixaPage({ searchParams }: PageProps<"/controladoria/caixa">) {
  const { cenario: c } = await searchParams;
  const cenario: CenarioCaixa = c === "conservador" ? "conservador" : "base";
  const dados = await carregarTelaCaixa(await createClient(), cenario);
  return <TelaCaixa dados={dados} cenario={cenario} />;
}

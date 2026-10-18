import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarCriativos, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { carregarSugestoesIa } from "@/lib/marketing/sugestoesIa";
import { TelaCampanha } from "@/components/marketing/tela-campanha";

// "Gerar novas sugestões" (Server Action desta página) chama a IA — até ~1 min.
export const maxDuration = 300;

// Marketing · detalhe da campanha ("conta:campanha"): criativos, recomendações e sugestões por IA.
export default async function CampanhaMarketingPage({ params, searchParams }: PageProps<"/marketing/campanhas/[chave]">) {
  const [{ chave }, { periodo: p }] = await Promise.all([params, searchParams]);
  const periodo: PeriodoMarketing = p === "30d" ? "30d" : "90d";
  const chaveCampanha = decodeURIComponent(chave);
  const supabase = await createClient();
  const [dados, sugestoes] = await Promise.all([carregarCriativos(supabase, chaveCampanha, periodo), carregarSugestoesIa(supabase, chaveCampanha)]);
  if (!dados) notFound();
  return <TelaCampanha dados={dados} periodo={periodo} sugestoes={sugestoes} />;
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarCriativos, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { TelaCampanha } from "@/components/marketing/tela-campanha";

// Marketing · detalhe da campanha ("conta:campanha"): criativos e recomendações.
export default async function CampanhaMarketingPage({ params, searchParams }: PageProps<"/marketing/campanhas/[chave]">) {
  const [{ chave }, { periodo: p }] = await Promise.all([params, searchParams]);
  const periodo: PeriodoMarketing = p === "30d" ? "30d" : "90d";
  const dados = await carregarCriativos(await createClient(), decodeURIComponent(chave), periodo);
  if (!dados) notFound();
  return <TelaCampanha dados={dados} periodo={periodo} />;
}

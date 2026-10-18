import { createClient } from "@/lib/supabase/server";
import { carregarDesempenho, type FiltroMarketing, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { TelaDesempenho } from "@/components/marketing/tela-desempenho";

const PERIODOS: PeriodoMarketing[] = ["30d", "90d", "ano", "tudo"];

// Marketing · Visão A — Desempenho de campanhas, da BU do contexto da AppBar.
export default async function MarketingPage({ searchParams }: PageProps<"/marketing">) {
  const { periodo: p, campanha: c } = await searchParams;
  // A BU segue o contexto dos dados da AppBar (Footlink | Academy).
  const bu: FiltroMarketing["bu"] = (await lerContextoDados()) === "academy" ? "academy" : "footlink";
  const filtro: FiltroMarketing = {
    periodo: PERIODOS.includes(p as PeriodoMarketing) ? (p as PeriodoMarketing) : "90d",
    bu,
    campanha: typeof c === "string" ? c : null,
  };
  const supabase = await createClient();
  return <TelaDesempenho dados={await carregarDesempenho(supabase, filtro)} filtro={filtro} />;
}

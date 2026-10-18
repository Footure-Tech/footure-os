import { createClient } from "@/lib/supabase/server";
import { carregarDesempenho, type FiltroMarketing, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { TelaDesempenho } from "@/components/marketing/tela-desempenho";

const PERIODOS: PeriodoMarketing[] = ["30d", "90d", "ano", "tudo"];

// Marketing · Visão A — Desempenho de campanhas. A BU inicial segue o contexto
// dos dados da AppBar (Footlink | Academy); "Todas" fica nas abas.
export default async function MarketingPage({ searchParams }: PageProps<"/marketing">) {
  const { periodo: p, bu: b, campanha: c } = await searchParams;
  const buPadrao: FiltroMarketing["bu"] = (await lerContextoDados()) === "academy" ? "academy" : "footlink";
  const filtro: FiltroMarketing = {
    periodo: PERIODOS.includes(p as PeriodoMarketing) ? (p as PeriodoMarketing) : "90d",
    bu: b === "todas" || b === "academy" || b === "footlink" ? b : buPadrao,
    campanha: typeof c === "string" ? c : null,
  };
  const supabase = await createClient();
  return <TelaDesempenho dados={await carregarDesempenho(supabase, filtro)} filtro={filtro} buPadrao={buPadrao} />;
}

import { createClient } from "@/lib/supabase/server";
import { carregarInvestimentoRetorno, type FiltroMarketing, type Granularidade, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { carregarVendasAcademy } from "@/lib/academy/vendas";
import { carregarVendas } from "@/lib/vendas/consultas";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { TelaRetorno } from "@/components/marketing/tela-retorno";

const PERIODOS: PeriodoMarketing[] = ["30d", "90d", "ano", "tudo"];

// Marketing · Visão B — Investimento × Retorno. Mesmos filtros da Visão A
// (mantidos ao trocar de visão); a receita contábil vem das vendas do Bling.
export default async function RetornoPage({ searchParams }: PageProps<"/marketing/retorno">) {
  const { periodo: p, bu: b, campanha: c, granularidade: g } = await searchParams;
  const buPadrao: FiltroMarketing["bu"] = (await lerContextoDados()) === "academy" ? "academy" : "footlink";
  const filtro: FiltroMarketing = {
    periodo: PERIODOS.includes(p as PeriodoMarketing) ? (p as PeriodoMarketing) : "90d",
    bu: b === "todas" || b === "academy" || b === "footlink" ? b : buPadrao,
    campanha: typeof c === "string" ? c : null,
  };
  const granularidade: Granularidade = g === "semana" ? "semana" : "mes";
  const supabase = await createClient();
  const [academy, footlink] = await Promise.all([carregarVendasAcademy(supabase), carregarVendas(supabase)]);
  const dados = await carregarInvestimentoRetorno(supabase, filtro, granularidade, {
    academy: academy.vendas.map((v) => ({ data: v.dataVenda, valor: v.valorTotal })),
    footlink: footlink.vendas.map((v) => ({ data: v.dataFechamento, valor: v.valorTotal })),
  });
  return <TelaRetorno dados={dados} filtro={filtro} buPadrao={buPadrao} granularidade={granularidade} />;
}

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { carregarInvestimentoRetorno, type FiltroMarketing, type Granularidade, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { carregarVendasAcademy } from "@/lib/academy/vendas";
import { carregarVendas } from "@/lib/vendas/consultas";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { TelaRetorno } from "@/components/marketing/tela-retorno";

const PERIODOS: PeriodoMarketing[] = ["30d", "90d", "ano", "tudo"];

// Marketing · Visão B — Investimento × Retorno. Mesmos filtros da Visão A
// (mantidos ao trocar de visão); a receita contábil vem das vendas do Bling.
export default async function RetornoPage({ searchParams }: PageProps<"/marketing/retorno">) {
  const { periodo: p, campanha: c, granularidade: g } = await searchParams;
  // A BU segue o contexto dos dados da AppBar (Footlink | Academy).
  const bu: FiltroMarketing["bu"] = (await lerContextoDados()) === "academy" ? "academy" : "footlink";
  const filtro: FiltroMarketing = {
    periodo: PERIODOS.includes(p as PeriodoMarketing) ? (p as PeriodoMarketing) : "90d",
    bu,
    campanha: typeof c === "string" ? c : null,
  };
  const granularidade: Granularidade = g === "semana" ? "semana" : "mes";
  const supabase = await createClient();
  // Receita contábil pelo client de serviço: o perfil Marketing não lê as
  // tabelas de vendas (RLS); a página já passou pelo exigirPapel do layout e
  // só data e valor de cada venda seguem para a série.
  const servico = createServiceClient();
  const [academy, footlink] = await Promise.all([carregarVendasAcademy(servico), carregarVendas(servico)]);
  const dados = await carregarInvestimentoRetorno(supabase, filtro, granularidade, {
    academy: academy.vendas.map((v) => ({ data: v.dataVenda, valor: v.valorTotal })),
    footlink: footlink.vendas.map((v) => ({ data: v.dataFechamento, valor: v.valorTotal })),
  });
  return <TelaRetorno dados={dados} filtro={filtro} granularidade={granularidade} />;
}

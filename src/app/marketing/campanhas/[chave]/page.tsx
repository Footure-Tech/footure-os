import { notFound, redirect } from "next/navigation";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { createClient } from "@/lib/supabase/server";
import {
  carregarCriativos,
  type PeriodoMarketing,
} from "@/lib/marketing/consultas";
import { carregarSugestoesIa } from "@/lib/marketing/sugestoesIa";
import { carregarVerificacoes } from "@/lib/marketing/verificacaoRastreio";
import { carregarFunil } from "@/lib/marketing/consultasFunil";
import type { ResultadoEstrategias } from "@/lib/marketing/estrategiasIa";
import { TelaCampanha, type VisaoCampanha } from "@/components/marketing/tela-campanha";

// "Gerar novas sugestões" e "Gerar novas estratégias" (Server Actions desta página) chamam a IA — até ~1 min.
export const maxDuration = 300;

// Marketing · detalhe da campanha ("conta:campanha"): criativos, recomendações
// e sugestões por IA (aba Criativos) ou o funil da impressão à venda (aba Funil).
export default async function CampanhaMarketingPage({
  params,
  searchParams,
}: PageProps<"/marketing/campanhas/[chave]">) {
  const [{ chave }, { periodo: p, visao: v }] = await Promise.all([params, searchParams]);
  const periodo: PeriodoMarketing = p === "30d" || p === "tudo" ? p : "90d";
  const visao: VisaoCampanha = v === "funil" ? "funil" : "criativos";
  const chaveCampanha = decodeURIComponent(chave);
  const supabase = await createClient();
  // A base comum (Meta e Kommo) é lida uma vez por requisição (cache em carregarBase).
  const [dados, sugestoes, verificacoes, funil, estrategias] = await Promise.all([
    carregarCriativos(supabase, chaveCampanha, periodo),
    visao === "criativos" ? carregarSugestoesIa(supabase, chaveCampanha) : null,
    visao === "criativos" ? carregarVerificacoes(supabase, chaveCampanha) : [],
    visao === "funil" ? carregarFunil(supabase, chaveCampanha, periodo) : null,
    visao === "funil" ? carregarSugestoesIa<ResultadoEstrategias>(supabase, chaveCampanha, "funil") : null,
  ]);
  if (!dados) notFound();
  // Campanha de outra BU que não a do contexto da AppBar: volta para a lista do contexto.
  const bu = (await lerContextoDados()) === "academy" ? "academy" : "footlink";
  if (dados.campanha.bu !== bu) redirect("/marketing");
  return (
    <TelaCampanha
      dados={dados}
      periodo={periodo}
      visao={visao}
      sugestoes={sugestoes}
      verificacoes={verificacoes}
      funil={funil}
      estrategias={estrategias}
    />
  );
}

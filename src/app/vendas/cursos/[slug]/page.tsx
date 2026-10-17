import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarVendasAcademy } from "@/lib/academy/vendas";
import { intervaloDoPeriodo, montarRelatorioCurso, type PeriodoCurso } from "@/lib/academy/relatorio";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { TelaCursoAcademy } from "@/components/vendas/tela-curso-academy";

const PERIODOS: PeriodoCurso[] = ["tudo", "90d", "30d"];

// Comercial · Academy · Curso: relatório de vendas da edição (0042/0044).
export default async function CursoAcademyPage({ params, searchParams }: PageProps<"/vendas/cursos/[slug]">) {
  const [{ slug }, { periodo: p }] = await Promise.all([params, searchParams]);
  const periodo = PERIODOS.includes(p as PeriodoCurso) ? (p as PeriodoCurso) : "tudo";
  const supabase = await createClient();
  const { curso: buscarCurso, listaCursos, sincronizadoEm } = await carregarVendasAcademy(supabase);
  const curso = buscarCurso(slug);
  if (!curso) notFound();

  const { inicio, fim } = intervaloDoPeriodo(periodo, curso.primeiraVenda, curso.ultimaVenda, hojeLocal());
  const noRecorte = (d: string) => d >= inicio && d <= fim;
  const compradores = [...curso.vendas, ...curso.canceladas]
    .filter((v) => noRecorte(v.dataVenda))
    .sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || Number(b.numeroPedido) - Number(a.numeroPedido));

  return (
    <TelaCursoAcademy
      curso={curso}
      cursos={listaCursos()}
      relatorio={montarRelatorioCurso(curso.vendas, inicio, fim)}
      periodo={periodo}
      compradores={compradores}
      sincronizadoEm={sincronizadoEm}
    />
  );
}

// Dashboard no contexto Academy: vendas de cursos (data da venda), receita
// mensal bruta × líquida, receita e vendas por curso, inadimplência das
// parcelas. Mesmos períodos do Dashboard do Footlink (mês, trimestre, 12 meses).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { hojeLocal } from "@/lib/financeiro/carteira";
import type { Periodo } from "@/lib/dashboard/indicadores";
import type { MesReceita } from "@/components/dashboard/graficos";
import { carregarCarteiraAcademy, inadimplenciaAcademy } from "./carteira";
import type { CategoriaVendaAcademy, VendaAcademy } from "./vendas";

type Supa = SupabaseClient<Database>;

const MESES_POR_PERIODO: Record<Periodo, number> = { mes: 1, tri: 3, "12m": 12 };
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Primeiro dia (aaaa-mm-01) do mês deslocado `delta` meses a partir de `hoje`. */
function inicioDoMes(hoje: string, delta: number) {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export interface CursoNoPeriodo {
  slug: string;
  nome: string;
  categoria: CategoriaVendaAcademy;
  vendas: number;
  bruto: number;
  liquido: number;
  ticketMedio: number;
  participacao: number;
  ultimaVenda: string;
}

const somar = (vs: VendaAcademy[], campo: (v: VendaAcademy) => number) => vs.reduce((s, v) => s + campo(v), 0);

export async function carregarDashboardAcademy(supabase: Supa, periodo: Periodo) {
  const hoje = hojeLocal();
  const carteira = await carregarCarteiraAcademy(supabase);
  const { vendas } = carteira;
  const n = MESES_POR_PERIODO[periodo];
  const inicio = inicioDoMes(hoje, -(n - 1));
  const inicioAnterior = inicioDoMes(hoje, -(2 * n - 1));
  // Período anterior até o mesmo dia do mês (comparação justa com o mês em curso).
  const [, , dia] = hoje.split("-");
  const fimAnteriorBase = inicioDoMes(hoje, -n);
  const fimAnterior = `${fimAnteriorBase.slice(0, 8)}${dia}` < inicio ? `${fimAnteriorBase.slice(0, 8)}${dia}` : fimAnteriorBase;
  const doPeriodo = vendas.filter((v) => v.dataVenda >= inicio && v.dataVenda <= hoje);
  const anterior = vendas.filter((v) => v.dataVenda >= inicioAnterior && v.dataVenda <= fimAnterior);

  const bruto = somar(doPeriodo, (v) => v.valorTotal);
  const brutoAnterior = somar(anterior, (v) => v.valorTotal);
  const porCursoMap = new Map<string, VendaAcademy[]>();
  for (const v of doPeriodo) porCursoMap.set(v.cursoSlug, [...(porCursoMap.get(v.cursoSlug) ?? []), v]);
  const porCurso: CursoNoPeriodo[] = [...porCursoMap]
    .map(([slug, lista]) => {
      const b = somar(lista, (v) => v.valorTotal);
      return {
        slug,
        nome: lista[0].curso,
        categoria: lista[0].categoria,
        vendas: lista.length,
        bruto: b,
        liquido: somar(lista, (v) => v.liquido),
        ticketMedio: b / lista.length,
        participacao: bruto > 0 ? b / bruto : 0,
        ultimaVenda: lista.reduce((m, v) => (v.dataVenda > m ? v.dataVenda : m), lista[0].dataVenda),
      };
    })
    .sort((a, b) => b.bruto - a.bruto);

  // Receita mensal dos últimos 12 meses: bruto e líquido pela data da venda.
  const receitaMensal: MesReceita[] = Array.from({ length: 12 }, (_, i) => {
    const chave = inicioDoMes(hoje, i - 11).slice(0, 7);
    const doMes = vendas.filter((v) => v.dataVenda.startsWith(chave));
    const [ano, mes] = chave.split("-").map(Number);
    return {
      chave,
      rotulo: MESES_CURTOS[mes - 1],
      rotuloCompleto: `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`,
      realizado: somar(doMes, (v) => v.valorTotal),
      previsto: somar(doMes, (v) => v.liquido),
      futuro: false,
    };
  });

  const inadimplencia = inadimplenciaAcademy(carteira);
  return {
    temCache: carteira.temCache,
    temParcelas: carteira.temParcelas,
    sincronizadoEm: carteira.sincronizadoEm,
    kpis: {
      bruto,
      liquido: somar(doPeriodo, (v) => v.liquido),
      variacaoBruto: brutoAnterior > 0 ? (bruto - brutoAnterior) / brutoAnterior : null,
      vendas: doPeriodo.length,
      vendasAnterior: anterior.length,
      cursosComVenda: porCurso.length,
      taxaInadimplencia: inadimplencia.resumo.taxa,
      vencido: inadimplencia.resumo.totalVencido,
      inadimplentes: inadimplencia.resumo.clientes,
    },
    receitaMensal,
    porCurso,
    faixas: inadimplencia.faixas,
  };
}

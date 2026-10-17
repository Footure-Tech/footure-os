import { MdInfoOutline, MdInsights, MdPayments, MdPeople, MdSchool, MdShowChart, MdStackedLineChart } from "react-icons/md";
import type { CursoAcademy, VendaAcademy } from "@/lib/academy/vendas";
import { ALIQUOTA_IMPOSTOS_ACADEMY, resumirPagamentos } from "@/lib/academy/vendas";
import { WIDGETS_OCULTOS, type PeriodoCurso, type RelatorioCurso } from "@/lib/academy/relatorio";
import { dataCurta } from "@/lib/academy/series";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { DivisaoValores, GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { IndicadorBling } from "@/components/financeiro/tela-contratos";
import { BadgeCategoria, BarraParticipacao } from "@/components/vendas/tela-vendas-academy";
import { GraficoEvolucao } from "@/components/vendas/relatorio/grafico-evolucao";
import { GraficoAcumulado } from "@/components/vendas/relatorio/grafico-acumulado";
import { SeletorCurso } from "@/components/vendas/relatorio/seletor-curso";
import { TabelaCompradores, type LinhaComprador } from "@/components/vendas/relatorio/tabela-compradores";

const PERIODOS: { valor: PeriodoCurso; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Edição inteira" },
  { valor: "90d", rotulo: "Últimos 90 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
];

function linhaComprador(v: VendaAcademy): LinhaComprador {
  return {
    chave: `${v.blingPedidoId}-${v.cursoSlug}`,
    blingPedidoId: v.blingPedidoId,
    numeroPedido: v.numeroPedido,
    data: v.dataVenda,
    nome: v.cliente,
    documentoMascarado: v.documentoMascarado,
    produto: v.produto,
    valor: v.valorTotal,
    valorPedido: v.valorPedido,
    rateado: v.rateado,
    formas: resumirPagamentos(v.pagamentos),
    situacao: v.situacao,
  };
}

// Comercial · Academy · Curso: relatório de vendas da edição — KPIs, evolução,
// acumulado, formas de pagamento, insights e compradores. Eixo: data da venda.
export function TelaCursoAcademy({
  curso,
  cursos,
  relatorio,
  periodo,
  compradores,
  sincronizadoEm,
}: {
  curso: CursoAcademy;
  /** Todos os cursos, em ordem alfabética, para o seletor. */
  cursos: { slug: string; nome: string }[];
  relatorio: RelatorioCurso;
  periodo: PeriodoCurso;
  /** Vendas do recorte, inclusive canceladas (marcadas na lista). */
  compradores: VendaAcademy[];
  sincronizadoEm: string | null;
}) {
  const { kpis } = relatorio;
  const hrefPeriodo = (p: PeriodoCurso) => (p === "tudo" ? `/vendas/cursos/${curso.slug}` : `/vendas/cursos/${curso.slug}?periodo=${p}`);
  const aliquota = `${ALIQUOTA_IMPOSTOS_ACADEMY * 100}%`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial · Academy · Curso"
        titulo={curso.nome}
        descricao={`Vendas de ${dataCurta(relatorio.inicio)} a ${dataCurta(relatorio.fim)} · por data da venda`}
        voltarHref="/vendas"
        acoes={
          <>
            <SeletorCurso cursos={cursos} atual={curso.slug} periodo={periodo} />
            <IndicadorBling sincronizadoEm={sincronizadoEm} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <CardModulo icone={MdSchool} cor="bg-iconBlue" titulo="Dados do curso" className="min-w-0">
          <div>
            <LinhaChaveValor rotulo="Categoria" valor={<BadgeCategoria categoria={curso.categoria} />} />
            <LinhaChaveValor rotulo="Nome" valor={curso.nome} />
            <LinhaChaveValor rotulo="Primeira venda" valor={formatarDataCurta(curso.primeiraVenda)} />
            <LinhaChaveValor rotulo="Última venda" valor={formatarDataCurta(curso.ultimaVenda)} />
          </div>
        </CardModulo>
        <div className="flex min-w-0 flex-col gap-4">
          <AbasFiltro valor={periodo} opcoes={PERIODOS.map((p) => ({ ...p, href: hrefPeriodo(p.valor) }))} />
          <GradeKpis className="grid-cols-1 sm:grid-cols-2">
            <KpiCard
              rotulo="Vendas"
              valor={String(kpis.vendas)}
              apoio={kpis.emAberto ? `${kpis.emAberto} em aberto no Bling` : "vendas líquidas (sem canceladas)"}
            />
            <KpiCard rotulo="Faturamento bruto" valor={formatarMoedaCompacta(kpis.bruto)} apoio={`ticket médio ${formatarMoeda(kpis.ticketMedio)}`} />
            <KpiCard
              rotulo="Líquido"
              valor={formatarMoedaCompacta(kpis.liquido)}
              apoio={`após taxas de pagamento e impostos (${aliquota})`}
              rodape={
                <DivisaoValores
                  partes={[
                    { rotulo: "Taxas de pagamento", valor: kpis.taxas },
                    { rotulo: `Impostos (${aliquota})`, valor: kpis.impostos },
                  ]}
                />
              }
            />
            <KpiCard
              rotulo="Faturamento médio/dia"
              valor={formatarMoedaCompacta(kpis.faturamentoDia)}
              apoio={`em ${relatorio.dias} ${relatorio.dias === 1 ? "dia" : "dias"} · ${formatarMoeda(kpis.ticketMedio)} por venda`}
            />
          </GradeKpis>
          {kpis.taxasEstimadas > 0 && (
            <p className="text-xs text-gray3">
              Taxa de {kpis.taxasEstimadas} {kpis.taxasEstimadas === 1 ? "venda estimada" : "vendas estimadas"} pela forma de pagamento (ainda sem baixa no Bling); as demais usam a tarifa real da baixa.
            </p>
          )}
        </div>
      </div>

      {kpis.vendas === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdShowChart} titulo="Nenhuma venda neste período" descricao="Escolha “Edição inteira” para ver todo o histórico do curso." />
        </div>
      ) : (
        <>
          <CardModulo icone={MdShowChart} cor="bg-iconPurple" titulo="Evolução das vendas" className="min-w-0">
            <GraficoEvolucao diaria={relatorio.diaria} />
          </CardModulo>

          <div className="grid gap-6 xl:grid-cols-2">
            <CardModulo icone={MdStackedLineChart} cor="bg-iconGreen" titulo="Faturamento acumulado" className="min-w-0">
              <GraficoAcumulado diaria={relatorio.diaria} />
            </CardModulo>
            <CardModulo icone={MdPayments} cor="bg-iconYellow" titulo="Formas de pagamento" className="min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Forma</TableHead>
                    <TableHead>Vendas</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="w-[38%]">Participação</TableHead>
                    <TableHead>Taxas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorio.pagamentos.map((p) => (
                    <TableRow key={p.rotulo}>
                      <TableCell className="font-bold text-darkPurple1">{p.rotulo}</TableCell>
                      <TableCell className="text-gray2">{p.vendas}</TableCell>
                      <TableCell className="font-semibold text-darkPurple1">{formatarMoeda(p.valor)}</TableCell>
                      <TableCell>
                        <BarraParticipacao parte={p.valor} total={kpis.bruto} />
                      </TableCell>
                      <TableCell className="text-gray2">{formatarMoeda(p.taxa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardModulo>
          </div>

          {relatorio.insights.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-darkPurple1">
                <MdInsights className="size-5 text-gray3" />
                Insights do período
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {relatorio.insights.map((i) => (
                  <article key={i.titulo} className="flex flex-col gap-1.5 rounded-xl border border-gray5 bg-surface p-5 shadow-card">
                    <h3 className="text-[15px] font-bold text-darkPurple1">{i.titulo}</h3>
                    <p className="text-sm leading-relaxed text-gray2">{i.texto}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-darkPurple1">
          <MdPeople className="size-5 text-gray3" />
          Compradores <span className="text-sm font-semibold text-gray3">({compradores.length})</span>
        </h2>
        <TabelaCompradores linhas={compradores.map(linhaComprador)} />
      </section>

      <div className="flex gap-2 rounded-xl border border-gray5 bg-surface p-4 text-xs text-gray3">
        <MdInfoOutline className="mt-px size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-bold text-gray2">Widgets ocultos por falta de dado de origem</span>
          {WIDGETS_OCULTOS.map((w) => (
            <span key={w.widget}>
              <strong className="font-semibold text-gray2">{w.widget}</strong>: {w.motivo}.
            </span>
          ))}
          <span>
            Valores por data da venda. Taxas: tarifa real da baixa no Bling ou, sem baixa, a taxa cadastrada na forma de pagamento. Impostos: {aliquota} do bruto. Canceladas
            aparecem na lista de compradores, fora dos totais.
          </span>
        </div>
      </div>
    </div>
  );
}

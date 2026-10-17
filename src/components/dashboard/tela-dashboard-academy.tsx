import Link from "next/link";
import { MdChevronRight, MdSchool, MdSync } from "react-icons/md";
import type { carregarDashboardAcademy } from "@/lib/academy/dashboard";
import type { Periodo } from "@/lib/dashboard/indicadores";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { GraficoReceitaMensal, LegendaSeries } from "@/components/dashboard/graficos";
import { BadgeCategoria, BarraParticipacao } from "@/components/vendas/tela-vendas-academy";
import { cn } from "@/lib/utils";

type Dados = Awaited<ReturnType<typeof carregarDashboardAcademy>>;

const ROTULO_PERIODO: Record<Periodo, { sufixo: string; curto: string; anterior: string }> = {
  mes: { sufixo: "mês", curto: "no mês", anterior: "vs. mês anterior" },
  tri: { sufixo: "trimestre", curto: "no trimestre", anterior: "vs. trimestre anterior" },
  "12m": { sufixo: "12m", curto: "em 12 meses", anterior: "vs. 12 meses anteriores" },
};
/** Cursos listados na receita por curso; o resto vira "Outros cursos". */
const MAX_CURSOS_RECEITA = 6;

function Card({ titulo, acao, children, className }: { titulo: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-darkPurple1">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace(".", ",")}%`;

// Dashboard no contexto Academy: vendas de cursos, receita bruta × líquida,
// receita e vendas por curso e inadimplência das parcelas.
export function TelaDashboardAcademy({ dados, periodo }: { dados: Dados; periodo: Periodo }) {
  const { kpis } = dados;
  const rotulo = ROTULO_PERIODO[periodo];
  const variacao = kpis.variacaoBruto;
  const principais = dados.porCurso.slice(0, MAX_CURSOS_RECEITA);
  const outros = dados.porCurso.slice(MAX_CURSOS_RECEITA);
  const brutoOutros = outros.reduce((s, c) => s + c.bruto, 0);
  const vendasOutros = outros.reduce((s, c) => s + c.vendas, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Gestão · Academy"
        titulo="Indicadores do negócio"
        descricao="Vendas de cursos do Footure Academy, por data da venda — pedidos do Bling."
        acoes={
          <SegmentedToggle
            valor={periodo}
            opcoes={[
              { valor: "mes", rotulo: "Mês", href: "/dashboard?periodo=mes" },
              { valor: "tri", rotulo: "Trimestre", href: "/dashboard?periodo=tri" },
              { valor: "12m", rotulo: "12 meses", href: "/dashboard?periodo=12m" },
            ]}
          />
        }
      />

      {!dados.temCache ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdSync} titulo="Vendas do Academy ainda não sincronizadas" descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral." />
        </div>
      ) : (
        <>
          <GradeKpis>
            <KpiCard
              rotulo={`Vendas bruto · ${rotulo.sufixo}`}
              valor={formatarMoedaCompacta(kpis.bruto)}
              destaque={variacao === null ? undefined : `${variacao >= 0 ? "+" : ""}${(variacao * 100).toFixed(0)}%`}
              tomDestaque={variacao === null ? "marca" : variacao >= 0 ? "positivo" : "negativo"}
              apoio={variacao === null ? `vendido ${rotulo.curto}` : rotulo.anterior}
              rodape={
                <>
                  Líquido <strong className="font-bold text-green1">{formatarMoedaCompacta(kpis.liquido)}</strong>
                  <span className="text-gray3"> · após taxas e impostos</span>
                </>
              }
            />
            <KpiCard
              rotulo={`Vendas · ${rotulo.sufixo}`}
              valor={String(kpis.vendas)}
              apoio={`${kpis.vendasAnterior} no período anterior`}
              rodape={kpis.vendas > 0 ? <>Ticket médio <strong className="font-bold text-darkPurple1">{formatarMoeda(kpis.bruto / kpis.vendas)}</strong></> : undefined}
            />
            <KpiCard rotulo={`Cursos com venda · ${rotulo.sufixo}`} valor={String(kpis.cursosComVenda)} apoio={`cursos (edições) que venderam ${rotulo.curto}`} />
            <KpiCard
              rotulo="Inadimplência"
              valor={dados.temParcelas ? `${(kpis.taxaInadimplencia * 100).toFixed(1).replace(".", ",")}%` : "—"}
              destaque={dados.temParcelas ? formatarMoedaCompacta(kpis.vencido) : undefined}
              tomDestaque="negativo"
              apoio={dados.temParcelas ? `das parcelas que venceram ${rotulo.curto}` : "sincronize o Bling"}
              rodape={
                dados.temParcelas ? (
                  <Link href="/inadimplencia" className="font-semibold text-purple-text hover:underline">
                    {kpis.inadimplentes} {kpis.inadimplentes === 1 ? "comprador" : "compradores"} com parcela vencida
                  </Link>
                ) : undefined
              }
            />
          </GradeKpis>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Card
              titulo="Receita mensal"
              acao={
                <LegendaSeries
                  itens={[
                    { rotulo: "Bruto", cor: "bg-chart-1" },
                    { rotulo: "Líquido", cor: "bg-chart-2" },
                  ]}
                />
              }
            >
              <GraficoReceitaMensal meses={dados.receitaMensal} series={["Bruto", "Líquido"]} />
              <p className="text-xs text-gray3">Vendas de cursos por mês da venda (12 meses); líquido = bruto − taxas de pagamento − impostos (13%).</p>
            </Card>
            <Card titulo={`Receita por curso · ${rotulo.sufixo}`}>
              {dados.porCurso.length === 0 ? (
                <EstadoVazio compacto icone={MdSchool} titulo="Nenhuma venda no período" />
              ) : (
                <ul className="flex flex-col gap-3">
                  {principais.map((c) => (
                    <li key={c.slug} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/vendas/cursos/${c.slug}`} className="min-w-0 truncate font-semibold text-darkPurple1 hover:underline" title={c.nome}>
                          {c.nome}
                        </Link>
                        <span className="shrink-0 font-bold text-darkPurple1">{formatarMoedaCompacta(c.bruto)}</span>
                      </div>
                      <BarraParticipacao parte={c.bruto} total={kpis.bruto} rotulo={`${c.vendas} ${c.vendas === 1 ? "venda" : "vendas"}`} />
                    </li>
                  ))}
                  {outros.length > 0 && (
                    <li className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-gray2">
                          Outros {outros.length} {outros.length === 1 ? "curso" : "cursos"}
                        </span>
                        <span className="shrink-0 font-bold text-darkPurple1">{formatarMoedaCompacta(brutoOutros)}</span>
                      </div>
                      <BarraParticipacao parte={brutoOutros} total={kpis.bruto} rotulo={`${vendasOutros} ${vendasOutros === 1 ? "venda" : "vendas"}`} />
                    </li>
                  )}
                </ul>
              )}
            </Card>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-darkPurple1">Vendas por curso · {rotulo.sufixo}</h2>
            {dados.porCurso.length === 0 ? (
              <div className="rounded-xl border border-gray5 bg-surface shadow-table">
                <EstadoVazio icone={MdSchool} titulo="Nenhum curso vendeu no período" descricao="Escolha um período maior no seletor acima." />
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
                {dados.porCurso.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/vendas/cursos/${c.slug}${periodo === "mes" ? "?periodo=30d" : periodo === "tri" ? "?periodo=90d" : ""}`}
                    className="group flex min-w-0 flex-col gap-3 rounded-xl border border-gray5 bg-surface p-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col items-start gap-1.5">
                        <span className="text-[15px] leading-snug font-bold text-darkPurple1">{c.nome}</span>
                        <BadgeCategoria categoria={c.categoria} />
                      </div>
                      <MdChevronRight className="mt-0.5 size-5 shrink-0 text-gray3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] leading-none font-extrabold tracking-[-0.02em] text-darkPurple1">{c.vendas}</span>
                      <span className="text-sm text-gray2">{c.vendas === 1 ? "venda" : "vendas"}</span>
                      <span className="ml-auto text-xs text-gray3">{pct(c.participacao)} do bruto</span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 border-t border-gray5 pt-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-gray3">Bruto</dt>
                        <dd className="font-bold text-darkPurple1">{formatarMoedaCompacta(c.bruto)}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-gray3">Líquido</dt>
                        <dd className="font-bold text-green1">{formatarMoedaCompacta(c.liquido)}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-gray3">Ticket médio</dt>
                        <dd className="font-bold text-darkPurple1">{formatarMoedaCompacta(c.ticketMedio)}</dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import type { IconType } from "react-icons";
import { MdChevronRight, MdError, MdFactCheck, MdGavel, MdHistoryEdu, MdSync, MdWarning } from "react-icons/md";
import type { carregarDashboard, Periodo, PontoAtencao } from "@/lib/dashboard/indicadores";
import { statusPedidoVisual } from "@/lib/status/visual";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { Avatar } from "@/components/ds/avatar";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { GraficoFaixasAtraso, GraficoReceitaMensal, LegendaSeries } from "@/components/dashboard/graficos";
import { cn } from "@/lib/utils";

export type LayoutDashboard = "geral" | "fluxo";
type Dados = Awaited<ReturnType<typeof carregarDashboard>>;

const ROTULO_PERIODO: Record<Periodo, { curto: string; anterior: string }> = {
  mes: { curto: "no mês", anterior: "vs. mês anterior" },
  tri: { curto: "no trimestre", anterior: "vs. trimestre anterior" },
  "12m": { curto: "em 12 meses", anterior: "vs. 12 meses anteriores" },
};

const VISUAL_PONTO: Record<PontoAtencao["tipo"], { icone: IconType; caixa: string }> = {
  validacao: { icone: MdGavel, caixa: "bg-lightPurple4 text-purple-text" },
  falha: { icone: MdError, caixa: "bg-dangerBg text-red" },
  assinatura_incompleta: { icone: MdWarning, caixa: "bg-dangerBg text-red" },
  aprovacao: { icone: MdFactCheck, caixa: "bg-green5 text-green1" },
  assinatura: { icone: MdHistoryEdu, caixa: "bg-orange3 text-[#ce9232]" },
  atraso: { icone: MdWarning, caixa: "bg-dangerBg text-red" },
};

function Card({ titulo, acao, children, className }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode; className?: string }) {
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

function LinkCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-purple-text hover:underline">
      {children}
    </Link>
  );
}

/** Receita por linha — só Footlink existe no sistema (Academy/Consultoria fora por decisão). */
function ReceitaPorLinha({ valor }: { valor: number }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="flex h-3 overflow-hidden rounded-md">
        <span className="h-full w-full bg-chart-1" />
      </span>
      <div className="flex items-center gap-3">
        <span className="size-2.5 shrink-0 rounded-sm bg-chart-1" />
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-bold text-darkPurple1">Footlink</span>
          <span className="text-xs text-gray3">SaaS · clubes e agentes</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-darkPurple1">{formatarMoedaCompacta(valor)}</span>
          <span className="text-xs text-gray3">100%</span>
        </div>
      </div>
      <p className="text-xs text-gray3">Academy e Consultoria ainda não fazem parte do sistema.</p>
    </div>
  );
}

// Tela "Gestão · Indicadores do negócio" do handoff — só apresentação.
export function TelaDashboard({
  dados,
  periodo,
  layout,
  urlLogo,
}: {
  dados: Dados;
  periodo: Periodo;
  layout: LayoutDashboard;
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const { kpis } = dados;
  const rotuloPeriodo = ROTULO_PERIODO[periodo];
  const href = (p: Periodo, l: LayoutDashboard) => `/dashboard?periodo=${p}&layout=${l}`;
  const variacao = kpis.variacaoReceita;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Gestão"
        titulo="Indicadores do negócio"
        descricao="Receita, funil comercial, contratos e recebimentos consolidados do Footlink."
        acoes={
          <>
            <SegmentedToggle
              valor={periodo}
              opcoes={[
                { valor: "mes", rotulo: "Mês", href: href("mes", layout) },
                { valor: "tri", rotulo: "Trimestre", href: href("tri", layout) },
                { valor: "12m", rotulo: "12 meses", href: href("12m", layout) },
              ]}
            />
            <SegmentedToggle
              valor={layout}
              opcoes={[
                { valor: "geral", rotulo: "Visão geral", href: href(periodo, "geral") },
                { valor: "fluxo", rotulo: "Fluxo", href: href(periodo, "fluxo") },
              ]}
            />
          </>
        }
      />

      <GradeKpis>
        <KpiCard
          rotulo={`Receita contratada · ${periodo === "mes" ? "mês" : periodo === "tri" ? "trimestre" : "12m"}`}
          valor={formatarMoedaCompacta(kpis.receitaContratada)}
          destaque={variacao === null ? `${kpis.contratosAssinados} contratos` : `${variacao >= 0 ? "+" : ""}${(variacao * 100).toFixed(0)}%`}
          tomDestaque={variacao === null ? "marca" : variacao >= 0 ? "positivo" : "negativo"}
          apoio={variacao === null ? `assinados ${rotuloPeriodo.curto}` : rotuloPeriodo.anterior}
        />
        <KpiCard
          rotulo="MRR Footlink"
          valor={formatarMoedaCompacta(kpis.mrr)}
          destaque={`${kpis.contratosVigentes} contratos`}
          apoio="vigentes no sistema"
        />
        <KpiCard
          rotulo="Pipeline aberto"
          valor={formatarMoedaCompacta(kpis.pipeline)}
          destaque={`${kpis.pedidosEmAndamento} pedidos`}
          apoio="em andamento"
        />
        <KpiCard
          rotulo="Inadimplência"
          valor={dados.temCacheBling ? `${(kpis.taxaInadimplencia * 100).toFixed(1).replace(".", ",")}%` : "—"}
          destaque={dados.temCacheBling ? formatarMoedaCompacta(kpis.vencido) : undefined}
          tomDestaque="negativo"
          apoio={dados.temCacheBling ? "vencido em carteira" : "sincronize o Bling"}
        />
      </GradeKpis>

      {layout === "geral" ? <VisaoGeral dados={dados} urlLogo={urlLogo} rotuloPeriodo={rotuloPeriodo.curto} /> : <Fluxo dados={dados} rotuloPeriodo={rotuloPeriodo.curto} />}
    </div>
  );
}

function VisaoGeral({ dados, urlLogo, rotuloPeriodo }: { dados: Dados; urlLogo: (p: string | null) => string | null; rotuloPeriodo: string }) {
  const baseFunil = dados.funil[0]?.quantidade ?? 0;
  // Em validação: SEMPRE todos visíveis (decisão de produto); os demais, até completar 6.
  const emValidacao = dados.contratosEmAndamento.filter((c) => c.status === "em_revisao_juridica" || c.status === "pronto_para_assinatura");
  const outros = dados.contratosEmAndamento.filter((c) => !emValidacao.includes(c));
  const contratosVisiveis = [...emValidacao, ...outros.slice(0, Math.max(0, 6 - emValidacao.length))];

  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card
          titulo="Receita mensal"
          acao={
            <LegendaSeries
              itens={[
                { rotulo: "Realizado", cor: "bg-chart-1" },
                { rotulo: "Previsto", cor: "bg-chart-2" },
              ]}
            />
          }
        >
          {dados.temCacheBling ? (
            <>
              <GraficoReceitaMensal meses={dados.receitaMensal} />
              <p className="text-xs text-gray3">Parcelas do Bling por mês de vencimento (o Bling não informa a data da baixa).</p>
            </>
          ) : (
            <EstadoVazio compacto icone={MdSync} titulo="Parcelas do Bling não sincronizadas" descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral." />
          )}
        </Card>
        <Card titulo="Receita por linha">
          <ReceitaPorLinha valor={dados.kpis.receitaContratada} />
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-5">
        <Card titulo="Funil comercial">
          <p className="-mt-2 text-xs text-gray3">Pedidos criados {rotuloPeriodo} e até onde chegaram (ainda não há leads no sistema).</p>
          <ul className="flex flex-col gap-3.5">
            {dados.funil.map((etapa, i) => {
              const anterior = i > 0 ? dados.funil[i - 1].quantidade : 0;
              return (
                <li key={etapa.rotulo} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="flex-1 text-gray2">{etapa.rotulo}</span>
                    <span className="font-bold text-darkPurple1">{etapa.quantidade}</span>
                    {i > 0 && <span className="w-11 text-right text-xs text-gray3">{anterior > 0 ? `${Math.round((etapa.quantidade / anterior) * 100)}%` : "—"}</span>}
                  </div>
                  <span className="h-2 overflow-hidden rounded-full bg-gray5">
                    <span
                      className="block h-full rounded-full bg-lightPurple1"
                      style={{ width: `${baseFunil > 0 ? (etapa.quantidade / baseFunil) * 100 : 0}%`, opacity: 1 - i * 0.15 }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card titulo="Contratos em andamento" acao={<LinkCard href="/juridico">Ver todos</LinkCard>}>
          {contratosVisiveis.length === 0 ? (
            <EstadoVazio compacto icone={MdGavel} titulo="Nenhum contrato em andamento" />
          ) : (
            <ul className="flex flex-col">
              {contratosVisiveis.map((c) => {
                const s = statusPedidoVisual(c.status, c.geracaoContratoErro);
                return (
                  <li key={c.id} className="border-b border-gray5 last:border-0">
                    <Link href={`/juridico?sel=${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover">
                      <LogoCliente url={urlLogo(c.logoPath)} nome={c.cliente} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold text-darkPurple1">{c.cliente}</span>
                        <span className="text-xs text-gray3">
                          {c.versao ? `v${c.versao} · ` : ""}
                          {formatarMoeda(c.valor)}
                        </span>
                      </span>
                      <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card titulo="Inadimplência por atraso" acao={<LinkCard href="/inadimplencia">Detalhar</LinkCard>}>
          {dados.temCacheBling ? (
            <GraficoFaixasAtraso faixas={[...dados.faixas]} />
          ) : (
            <EstadoVazio compacto icone={MdSync} titulo="Parcelas do Bling não sincronizadas" />
          )}
        </Card>
      </div>
    </>
  );
}

function Fluxo({ dados, rotuloPeriodo }: { dados: Dados; rotuloPeriodo: string }) {
  const maiorValor = Math.max(...dados.fluxo.map((b) => b.valor), 1);
  const maiorVendedor = Math.max(...dados.vendedores.map((v) => v.valor), 1);

  return (
    <>
      <Card titulo="Fluxo de receita" acao={<span className="text-xs text-gray3">Pedido → Aprovação → Contrato → Assinatura → Parcelas</span>}>
        <div className="overflow-x-auto">
          <ol className="grid min-w-[760px] grid-cols-5">
            {dados.fluxo.map((b, i) => (
              <li key={b.rotulo}>
                <Link
                  href={b.href}
                  className={cn(
                    "-ml-px flex h-full flex-col gap-1 border border-gray5 p-4 transition-colors hover:bg-surface-hover",
                    i === 0 && "ml-0 rounded-l-xl",
                    i === dados.fluxo.length - 1 && "rounded-r-xl",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex size-[22px] items-center justify-center rounded-full bg-lightPurple1 text-[11px] font-bold text-white">{i + 1}</span>
                    <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{b.rotulo}</span>
                  </span>
                  <span className="mt-1 text-[32px] leading-none font-extrabold tracking-[-0.02em] text-darkPurple1">{b.quantidade}</span>
                  <span className="text-sm font-semibold text-darkPurple1">{formatarMoedaCompacta(b.valor)}</span>
                  <span className="text-xs text-gray3">{b.sub}</span>
                  <span className="mt-2 h-1 overflow-hidden rounded-full bg-gray5">
                    <span className="block h-full rounded-full bg-lightPurple1" style={{ width: `${(b.valor / maiorValor) * 100}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
        <Card titulo={`Realizado por vendedor · ${rotuloPeriodo}`}>
          <p className="-mt-2 text-xs text-gray3">Contratos assinados. Metas por vendedor ainda não são cadastradas no sistema.</p>
          {dados.vendedores.length === 0 ? (
            <EstadoVazio compacto titulo="Nenhum contrato assinado no período" />
          ) : (
            <ul className="flex flex-col gap-4">
              {dados.vendedores.map((v) => (
                <li key={v.nome} className="flex items-center gap-3">
                  <Avatar nome={v.nome} tamanho={40} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-bold text-darkPurple1">{v.nome}</span>
                      <span className="shrink-0 text-xs text-gray3">
                        {v.contratos} {v.contratos === 1 ? "contrato" : "contratos"}
                      </span>
                    </div>
                    <span className="h-2 overflow-hidden rounded-full bg-gray5">
                      <span className="block h-full rounded-full bg-lightPurple1" style={{ width: `${(v.valor / maiorVendedor) * 100}%` }} />
                    </span>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-bold text-darkPurple1">{formatarMoedaCompacta(v.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-gray5 pt-3 text-sm">
            <span className="flex items-center gap-2 text-gray2">
              <span className="size-2.5 rounded-sm bg-chart-1" />
              Footlink
            </span>
            <span className="font-bold text-darkPurple1">{formatarMoedaCompacta(dados.kpis.receitaContratada)}</span>
          </div>
        </Card>

        <Card titulo="Pontos de atenção">
          {dados.pontos.length === 0 ? (
            <EstadoVazio compacto titulo="Nada pendente" descricao="Sem contratos em validação, falhas, assinaturas paradas ou atrasos." />
          ) : (
            <ul className="flex flex-col gap-1">
              {dados.pontos.map((p, i) => {
                const v = VISUAL_PONTO[p.tipo];
                const Icone = v.icone;
                return (
                  <li key={`${p.href}-${i}`}>
                    <Link href={p.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", v.caixa)}>
                        <Icone className="size-[18px]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-bold text-darkPurple1">{p.titulo}</span>
                        <span className="truncate text-[13px] text-gray">{p.descricao}</span>
                      </span>
                      <MdChevronRight className="size-[18px] shrink-0 text-gray3" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

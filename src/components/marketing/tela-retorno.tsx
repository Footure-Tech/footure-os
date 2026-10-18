import Link from "next/link";
import {
  MdCampaign,
  MdErrorOutline,
  MdInfoOutline,
  MdWarningAmber,
} from "react-icons/md";
import {
  ROTULO_BU,
  type carregarInvestimentoRetorno,
  type FiltroMarketing,
  type Granularidade,
  type PeriodoMarketing,
} from "@/lib/marketing/consultas";
import {
  formatarMoeda,
  formatarMoedaCompacta,
  tempoDecorrido,
} from "@/lib/formatacao";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { CardModulo } from "@/components/negocio/card-modulo";
import { SeletorCampanha } from "@/components/marketing/seletor-campanha";
import { GraficoInvestimentoRetorno } from "@/components/marketing/grafico-investimento-retorno";
import {
  TOM_BU,
  hrefDesempenho,
  hrefRetorno,
} from "@/components/marketing/links";
import { cn } from "@/lib/utils";

type Dados = Awaited<ReturnType<typeof carregarInvestimentoRetorno>>;

const PERIODOS: { valor: PeriodoMarketing; rotulo: string }[] = [
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Ano inteiro" },
  { valor: "tudo", rotulo: "Tudo" },
];

const roas = (v: number | null) =>
  v === null ? "—" : v.toFixed(2).replace(".", ",");
const moeda = (v: number | null) => (v === null ? "—" : formatarMoeda(v));
const dataCurta = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

// Marketing · Visão B — Investimento × Retorno: verba da Meta e quanto voltou
// em receita atribuída pelo Kommo (parcial), com cobertura sempre visível. A
// receita contábil (vendas no Bling) aparece ao lado, nunca somada.
export function TelaRetorno({
  dados,
  filtro,
  granularidade,
}: {
  dados: Dados;
  filtro: FiltroMarketing;
  granularidade: Granularidade;
}) {
  const { kpis, cobertura } = dados;
  const href = (
    f: Partial<FiltroMarketing>,
    g: Granularidade = granularidade,
  ) => hrefRetorno({ ...filtro, ...f }, g);
  const fraco = cobertura.baixa;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo={`Marketing · ${ROTULO_BU[filtro.bu === "todas" ? "academy" : filtro.bu]}`}
        titulo="Investimento × Retorno"
        descricao="Verba da Meta e a receita que voltou, atribuída pelo Kommo — por mês ou semana e por campanha."
        acoes={
          <>
            <Link
              href={hrefDesempenho(filtro)}
              className="text-sm font-semibold text-purple-text hover:underline"
            >
              Ver desempenho de campanhas
            </Link>
            <SegmentedToggle
              valor={filtro.periodo}
              opcoes={PERIODOS.map((p) => ({
                ...p,
                href: href({ periodo: p.valor }),
              }))}
            />
          </>
        }
      />

      {dados.erroSync && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red/30 bg-dangerBg px-5 py-4 text-sm text-red">
          <MdErrorOutline className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong className="font-bold">
              A última sincronização falhou:
            </strong>{" "}
            {dados.erroSync}
            {dados.sincronizadoEm &&
              ` · dados até ${tempoDecorrido(dados.sincronizadoEm)}`}
          </span>
        </div>
      )}

      {!dados.temDados ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdCampaign}
            titulo="Mídia ainda não sincronizada"
            descricao="Rode a primeira carga do histórico em Administração · Configurações · Marketing."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SeletorCampanha
              opcoes={dados.opcoesCampanha}
              valor={filtro.campanha ?? null}
              hrefBase={href({ campanha: null })}
            />
          </div>

          <GradeKpis>
            <KpiCard
              rotulo="Investimento"
              valor={formatarMoedaCompacta(kpis.investimento)}
              apoio={`Meta · de ${dataCurta(dados.de)} a ${dataCurta(dados.ate)}`}
            />
            <KpiCard
              rotulo="Receita atribuída"
              valor={formatarMoedaCompacta(kpis.receita)}
              corValor={fraco ? "text-gray3" : undefined}
              apoio="vendas do Kommo ligadas a campanha"
              rodape={
                kpis.contabil !== null ? (
                  <>
                    Receita contábil (Bling){" "}
                    <strong className="font-bold text-darkPurple1">
                      {formatarMoedaCompacta(kpis.contabil)}
                    </strong>
                    <span className="text-gray3">
                      {" "}
                      · referência, não somada
                    </span>
                  </>
                ) : undefined
              }
            />
            <KpiCard
              rotulo="ROAS parcial"
              valor={roas(kpis.roas)}
              corValor={
                fraco
                  ? "text-gray3"
                  : kpis.roas !== null && kpis.roas >= 1
                    ? "text-green1"
                    : "text-red"
              }
              apoio="sobre a receita atribuída"
            />
            <KpiCard
              rotulo="CAC teto"
              valor={moeda(kpis.cacTeto)}
              corValor={fraco ? "text-gray3" : undefined}
              apoio="investimento ÷ vendas (primeiro toque pago)"
            />
          </GradeKpis>

          <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-gray5 bg-surface px-6 py-4 shadow-card">
            <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
              Cobertura de atribuição
            </span>
            {cobertura.vendasTotais ? (
              <>
                <BarraProgresso
                  feito={cobertura.vendasAtribuidas}
                  total={cobertura.vendasTotais}
                  largura="w-40"
                />
                <span className="text-sm text-gray2">
                  {cobertura.vendasAtribuidas} de {cobertura.vendasTotais}{" "}
                  vendas do Kommo com campanha (
                  {Math.round((cobertura.taxa ?? 0) * 100)}%)
                  {!filtro.campanha && (
                    <>
                      {" "}
                      · receita não atribuída{" "}
                      <strong className="font-bold text-darkPurple1">
                        {formatarMoedaCompacta(cobertura.receitaNaoAtribuida)}
                      </strong>
                    </>
                  )}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray3">
                Nenhuma venda no Kommo no período.
              </span>
            )}
          </section>

          {fraco && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange2/40 bg-orange3 px-5 py-4 text-sm text-[#8a5a12]">
              <MdWarningAmber className="mt-0.5 size-5 shrink-0" />
              <span>
                <strong className="font-bold">
                  Cobertura baixa ({Math.round((cobertura.taxa ?? 0) * 100)}%)
                </strong>{" "}
                — o ROAS e o CAC não representam a BU. Resolva o rastreio (UTM
                das vendas) antes de decidir verba.
              </span>
            </div>
          )}

          <CardModulo
            icone={MdCampaign}
            cor="bg-iconGreen"
            titulo="Investimento × Receita atribuída"
            className="min-w-0"
            extra={
              <SegmentedToggle
                valor={granularidade}
                opcoes={[
                  { valor: "mes", rotulo: "Mês", href: href({}, "mes") },
                  {
                    valor: "semana",
                    rotulo: "Semana",
                    href: href({}, "semana"),
                  },
                ]}
              />
            }
          >
            <GraficoInvestimentoRetorno pontos={dados.serie} />
            <p className="text-xs text-gray3">
              Receita lançada na data de criação do lead (coorte). Safra
              imatura: leads criados depois de{" "}
              {dataCurta(dados.corteMaturidade)} (mediana de{" "}
              {dados.medianaDias.toFixed(1).replace(".", ",")} dias entre lead e
              venda) — a verba recente ainda gera receita que não fechou.
            </p>
          </CardModulo>

          {dados.tabela.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio
                compacto
                icone={MdCampaign}
                titulo="Nenhuma campanha com investimento no período"
                descricao="Ajuste o período, a BU ou a campanha."
              />
            </div>
          ) : (
            <Table minWidth={980}>
              <TableHeader>
                <TableRow>
                  <TableHead>BU / Campanha</TableHead>
                  <TableHead>Investimento ↓</TableHead>
                  <TableHead>Receita atribuída</TableHead>
                  <TableHead>ROAS parcial</TableHead>
                  <TableHead>CAC teto</TableHead>
                  <TableHead>Receita contábil (Bling)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.porBu.map((b) => (
                  <RowsBu
                    key={b.bu}
                    bu={b}
                    linhas={dados.tabela.filter((l) => l.bu === b.bu)}
                    fraco={fraco}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex gap-2 rounded-xl border border-gray5 bg-surface p-4 text-xs text-gray3">
            <MdInfoOutline className="mt-px size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <span>
                <strong className="font-semibold text-gray2">
                  Receita atribuída (parcial):
                </strong>{" "}
                só vendas do Kommo com campanha ou anúncio rastreado. ROAS e CAC
                usam só essa receita; o CAC é um teto (primeiro toque pago,
                quando registrado).
              </span>
              <span>
                <strong className="font-semibold text-gray2">
                  Receita contábil (Bling):
                </strong>{" "}
                vendas registradas no Bling no período (Academy: cursos;
                Footlink: pedidos de venda), mostrada como referência — não é
                atribuída a campanha nem somada.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RowsBu({
  bu,
  linhas,
  fraco,
}: {
  bu: Dados["porBu"][number];
  linhas: Dados["tabela"];
  fraco: boolean;
}) {
  return (
    <>
      <TableRow className="bg-surface-hover/60">
        <TableCell>
          <BadgeTom tom={TOM_BU[bu.bu]}>{ROTULO_BU[bu.bu]}</BadgeTom>
        </TableCell>
        <TableCell className="font-bold text-darkPurple1">
          {formatarMoeda(bu.investimento)}
        </TableCell>
        <TableCell className="font-bold text-darkPurple1">
          {formatarMoeda(bu.receita)}
        </TableCell>
        <TableCell
          className={cn(
            "font-bold",
            fraco
              ? "text-gray3"
              : bu.roas !== null && bu.roas >= 1
                ? "text-green1"
                : "text-red",
          )}
        >
          {roas(bu.roas)}
        </TableCell>
        <TableCell
          className={cn("font-bold text-darkPurple1", fraco && "text-gray3")}
        >
          {moeda(bu.cacTeto)}
        </TableCell>
        <TableCell className="font-bold text-darkPurple1">
          {bu.contabil === null ? "—" : formatarMoeda(bu.contabil)}
        </TableCell>
      </TableRow>
      {linhas.map((l) => (
        <TableRow key={l.chave}>
          <TableCell className="max-w-[380px] pl-8 whitespace-normal">
            <Link
              href={`/marketing/campanhas/${encodeURIComponent(l.chave)}`}
              className="font-semibold text-purple-text hover:underline"
            >
              {l.nome}
            </Link>
          </TableCell>
          <TableCell className="text-gray2">
            {formatarMoeda(l.investimento)}
          </TableCell>
          <TableCell className="text-gray2">
            {l.receita ? formatarMoeda(l.receita) : "—"}
          </TableCell>
          <TableCell className={cn("text-gray2", fraco && "opacity-60")}>
            {roas(l.receita ? l.roas : null)}
          </TableCell>
          <TableCell className={cn("text-gray2", fraco && "opacity-60")}>
            {moeda(l.cacTeto)}
          </TableCell>
          <TableCell className="text-gray3">—</TableCell>
        </TableRow>
      ))}
    </>
  );
}

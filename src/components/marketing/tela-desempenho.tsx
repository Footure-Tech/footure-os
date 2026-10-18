import { MdCampaign, MdChevronRight, MdErrorOutline, MdInfoOutline, MdWarningAmber } from "react-icons/md";
import type { BuMarketing } from "@/lib/supabase/database.types";
import { ROTULO_BU, type carregarDesempenho, type FiltroMarketing, type PeriodoMarketing } from "@/lib/marketing/consultas";
import { formatarMoeda, formatarMoedaCompacta, tempoDecorrido } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro, SegmentedToggle } from "@/components/ds/alternadores";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { BadgeTom } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { ExportarCsv } from "@/components/inadimplencia/exportar-csv";
import { SeletorCampanha } from "@/components/marketing/seletor-campanha";
import { cn } from "@/lib/utils";

type Dados = Awaited<ReturnType<typeof carregarDesempenho>>;

const PERIODOS: { valor: PeriodoMarketing; rotulo: string }[] = [
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Ano inteiro" },
  { valor: "tudo", rotulo: "Tudo" },
];
export const TOM_BU: Record<BuMarketing, "info" | "purple"> = { academy: "info", footlink: "purple" };

/** URL da Visão A com os filtros (os padrões ficam fora da URL). */
export function hrefDesempenho(f: FiltroMarketing, buPadrao: FiltroMarketing["bu"]) {
  const p = new URLSearchParams();
  if (f.periodo !== "90d") p.set("periodo", f.periodo);
  if (f.bu !== buPadrao) p.set("bu", f.bu);
  if (f.campanha) p.set("campanha", f.campanha);
  const qs = p.toString();
  return qs ? `/marketing?${qs}` : "/marketing";
}

const moeda = (v: number | null) => (v === null ? "—" : formatarMoeda(v));
const decimal = (v: number | null, casas = 2) => (v === null ? "—" : v.toFixed(casas).replace(".", ","));
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

// Marketing · Visão A — Desempenho de campanhas: gasto e leads da Meta cruzados
// com MQL, vendas e receita do Kommo. Atribuição parcial: ROAS "parcial" e CAC
// "teto", sempre com a cobertura ao lado.
export function TelaDesempenho({ dados, filtro, buPadrao }: { dados: Dados; filtro: FiltroMarketing; buPadrao: FiltroMarketing["bu"] }) {
  const { kpis, cobertura } = dados;
  const href = (f: Partial<FiltroMarketing>) => hrefDesempenho({ ...filtro, ...f }, buPadrao);
  const fraco = cobertura.baixa;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Marketing"
        titulo="Desempenho de campanhas"
        descricao="Gasto e leads da Meta cruzados com MQL, vendas e receita do Kommo."
        acoes={<SegmentedToggle valor={filtro.periodo} opcoes={PERIODOS.map((p) => ({ ...p, href: href({ periodo: p.valor, campanha: null }) }))} />}
      />

      {dados.erroSync && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red/30 bg-dangerBg px-5 py-4 text-sm text-red">
          <MdErrorOutline className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong className="font-bold">A última sincronização falhou:</strong> {dados.erroSync}
            {dados.sincronizadoEm && ` · dados até ${tempoDecorrido(dados.sincronizadoEm)}`}
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
            <AbasFiltro
              valor={filtro.bu}
              opcoes={[
                { valor: "todas", rotulo: "Todas", href: href({ bu: "todas", campanha: null }) },
                { valor: "academy", rotulo: ROTULO_BU.academy, href: href({ bu: "academy", campanha: null }) },
                { valor: "footlink", rotulo: ROTULO_BU.footlink, href: href({ bu: "footlink", campanha: null }) },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <SeletorCampanha opcoes={dados.opcoesCampanha} valor={filtro.campanha ?? null} hrefBase={href({ campanha: null })} />
              <ExportarCsv
                nomeArquivo={`marketing-campanhas-${dados.de}-a-${dados.ate}.csv`}
                cabecalho={["Campanha", "BU", "Gasto", "Impressões", "Frequência", "Leads Meta", "CPL Meta", "Leads CRM", "CPL CRM", "MQL", "Custo/MQL", "Vendas", "CAC teto", "Receita atribuída", "ROAS parcial", "Saturação", "Jovem"]}
                linhas={dados.linhas.map((l) => [
                  l.nome,
                  ROTULO_BU[l.bu],
                  l.gasto.toFixed(2).replace(".", ","),
                  l.impressoes,
                  decimal(l.frequencia),
                  inteiro(l.leadsMeta),
                  decimal(l.cplMeta),
                  l.leadsCrm,
                  decimal(l.cplCrm),
                  l.mql,
                  decimal(l.custoMql),
                  l.vendas,
                  decimal(l.cacTeto),
                  l.receita.toFixed(2).replace(".", ","),
                  decimal(l.roas),
                  l.motivoSaturacao,
                  l.jovem ? "sim" : "",
                ])}
              />
            </div>
          </div>

          <GradeKpis>
            <KpiCard rotulo="Gasto" valor={formatarMoedaCompacta(kpis.gasto)} apoio={`de ${dataCurta(dados.de)} a ${dataCurta(dados.ate)}`} />
            <KpiCard
              rotulo="Leads (Meta)"
              valor={inteiro(kpis.leadsMeta)}
              apoio={`CPL Meta ${moeda(kpis.cplMeta)}`}
              rodape={
                <>
                  Leads no CRM <strong className="font-bold text-darkPurple1">{inteiro(kpis.leadsCrm)}</strong>
                  <span className="text-gray3"> · {kpis.mql} MQL</span>
                </>
              }
            />
            <KpiCard
              rotulo="Vendas atribuídas"
              valor={String(kpis.vendas)}
              corValor={fraco ? "text-gray3" : undefined}
              apoio={`CAC teto ${moeda(kpis.cacTeto)}`}
            />
            <KpiCard
              rotulo="Receita atribuída"
              valor={formatarMoedaCompacta(kpis.receita)}
              corValor={fraco ? "text-gray3" : undefined}
              destaque={kpis.roas === null ? undefined : `ROAS ${decimal(kpis.roas)}`}
              tomDestaque={fraco ? "marca" : kpis.roas !== null && kpis.roas >= 1 ? "positivo" : "negativo"}
              apoio="ROAS parcial (sobre a receita atribuída)"
            />
          </GradeKpis>

          <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-gray5 bg-surface px-6 py-4 shadow-card">
            <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Cobertura de atribuição</span>
            {cobertura.vendasTotais ? (
              <>
                <BarraProgresso feito={cobertura.vendasAtribuidas} total={cobertura.vendasTotais} largura="w-40" />
                <span className="text-sm text-gray2">
                  {cobertura.vendasAtribuidas} de {cobertura.vendasTotais} vendas do Kommo com campanha ({Math.round((cobertura.taxa ?? 0) * 100)}%) · receita não atribuída{" "}
                  <strong className="font-bold text-darkPurple1">{formatarMoedaCompacta(cobertura.receitaNaoAtribuida)}</strong>
                </span>
              </>
            ) : (
              <span className="text-sm text-gray3">Nenhuma venda no Kommo no período.</span>
            )}
            <span className="ml-auto text-xs text-gray3">Maturidade: mediana de {decimal(dados.medianaDias, 1)} dias lead → venda</span>
          </section>

          {fraco && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange2/40 bg-orange3 px-5 py-4 text-sm text-[#8a5a12]">
              <MdWarningAmber className="mt-0.5 size-5 shrink-0" />
              <span>
                <strong className="font-bold">Cobertura baixa ({Math.round((cobertura.taxa ?? 0) * 100)}%)</strong> — ROAS e CAC não representam a BU. Resolva o rastreio (UTM das vendas) antes de decidir verba.
              </span>
            </div>
          )}

          {dados.linhas.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio compacto icone={MdCampaign} titulo="Nenhuma campanha com gasto no período" descricao="Ajuste o período, a BU ou a campanha." />
            </div>
          ) : (
            <Table minWidth={1600}>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Gasto ↓</TableHead>
                  <TableHead>Impr.</TableHead>
                  <TableHead>Freq.</TableHead>
                  <TableHead>Leads Meta</TableHead>
                  <TableHead>CPL Meta</TableHead>
                  <TableHead>Leads CRM</TableHead>
                  <TableHead>MQL</TableHead>
                  <TableHead>Custo/MQL</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>CAC teto</TableHead>
                  <TableHead>Receita</TableHead>
                  <TableHead>ROAS parcial</TableHead>
                  <TableHead>Sinais</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.linhas.map((l) => (
                  <LinhaClicavel key={l.chave} href={`/marketing/campanhas/${encodeURIComponent(l.chave)}${filtro.periodo !== "90d" ? `?periodo=${filtro.periodo}` : ""}`}>
                    <TableCell className="max-w-[340px] whitespace-normal">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold text-purple-text">{l.nome}</span>
                        <BadgeTom tom={TOM_BU[l.bu]}>{ROTULO_BU[l.bu]}</BadgeTom>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-darkPurple1">{formatarMoeda(l.gasto)}</TableCell>
                    <TableCell className="text-gray2">{inteiro(l.impressoes)}</TableCell>
                    <TableCell className="text-gray2">{decimal(l.frequencia)}</TableCell>
                    <TableCell className="text-gray2">{inteiro(l.leadsMeta)}</TableCell>
                    <TableCell className="text-gray2">{moeda(l.cplMeta)}</TableCell>
                    <TableCell className="text-gray2">
                      {l.leadsCrm}
                      {l.cplCrm !== null && <span className="block text-xs text-gray3">CPL {moeda(l.cplCrm)}</span>}
                    </TableCell>
                    <TableCell className="text-gray2">{l.mql}</TableCell>
                    <TableCell className="text-gray2">{moeda(l.custoMql)}</TableCell>
                    <TableCell className="text-gray2">{l.vendas}</TableCell>
                    <TableCell className={cn("text-gray2", fraco && "opacity-60")}>{moeda(l.cacTeto)}</TableCell>
                    <TableCell className="font-semibold text-darkPurple1">{l.receita ? formatarMoeda(l.receita) : "—"}</TableCell>
                    <TableCell className={cn("font-bold", fraco ? "text-gray3" : l.roas !== null && l.roas >= 1 ? "text-green1" : "text-red")}>{decimal(l.roas)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {l.saturando && (
                          <span title={l.motivoSaturacao}>
                            <StatusPill tom="pending">Saturando</StatusPill>
                          </span>
                        )}
                        {l.jovem && (
                          <span title="Leads recentes demais para julgar (safra imatura)">
                            <StatusPill tom="not_started">Jovem · sem veredito</StatusPill>
                          </span>
                        )}
                        {l.saturando && <span className="max-w-[220px] text-xs whitespace-normal text-gray3">{l.motivoSaturacao}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <MdChevronRight className="size-[18px] text-gray3" />
                    </TableCell>
                  </LinhaClicavel>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex gap-2 rounded-xl border border-gray5 bg-surface p-4 text-xs text-gray3">
            <MdInfoOutline className="mt-px size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <span>
                <strong className="font-semibold text-gray2">Atribuição parcial:</strong> só vendas do Kommo com campanha ou anúncio rastreado entram na receita; o ROAS é <em>parcial</em> e o CAC é um <em>teto</em>
                (pelo primeiro toque pago, quando registrado). Receita e vendas na data de criação do lead.
              </span>
              <span>
                <strong className="font-semibold text-gray2">Sinais:</strong> saturação = frequência ≥ {decimal(dados.limiares.freq_alerta, 1)} ou CPL da 2ª metade do período ≥ {decimal(dados.limiares.cpl_piora, 1)}× o da 1ª (com {dados.limiares.min_leads}+ leads).
                Jovem = mais da metade dos leads ainda sem tempo de virar venda.
              </span>
              <span>Leads de funis fora das BUs (Footure PRO, Footure Insights) não entram. Recomendações para validação humana — nada é executado automaticamente.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

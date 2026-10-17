import { MdChevronRight, MdSchool } from "react-icons/md";
import type { CategoriaVendaAcademy, CursoAcademy, PeriodoVendasAcademy, VendaAcademy } from "@/lib/academy/vendas";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro, SegmentedToggle } from "@/components/ds/alternadores";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { DivisaoValores, GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { IndicadorBling } from "@/components/financeiro/tela-contratos";

const ABAS: { valor: PeriodoVendasAcademy; rotulo: string; vazio: string }[] = [
  { valor: "mes", rotulo: "Mês atual", vazio: "Nenhuma venda neste mês." },
  { valor: "tri", rotulo: "Trimestre", vazio: "Nenhuma venda nos últimos 3 meses." },
  { valor: "12m", rotulo: "12 meses", vazio: "Nenhuma venda nos últimos 12 meses." },
];
export const ROTULO_CATEGORIA: Record<CategoriaVendaAcademy, string> = { especializacao: "Especialização", livre: "Curso livre", hotmart: "Hotmart" };

export type VisaoVendasAcademy = "cursos" | "vendas";

/** URL da tela com o período e a visão (os padrões ficam fora da URL). */
function hrefVendas(periodo: PeriodoVendasAcademy, visao: VisaoVendasAcademy) {
  const params = new URLSearchParams();
  if (periodo !== "mes") params.set("periodo", periodo);
  if (visao !== "cursos") params.set("visao", visao);
  const qs = params.toString();
  return qs ? `/vendas?${qs}` : "/vendas";
}

export function BadgeCategoria({ categoria }: { categoria: CategoriaVendaAcademy }) {
  return <BadgeTom tom={categoria === "especializacao" ? "info" : categoria === "livre" ? "pending" : "inactive"}>{ROTULO_CATEGORIA[categoria]}</BadgeTom>;
}

const quantidade = (n: number) => `${n} ${n === 1 ? "venda" : "vendas"}`;

function ValorEQuantidade({ valor, vendas }: { valor: number; vendas: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-bold text-darkPurple1">{formatarMoeda(valor)}</span>
      <span className="text-xs text-gray3">{quantidade(vendas)}</span>
    </div>
  );
}

/** Quanto o período representa do total vendido no curso (por valor). */
export function BarraParticipacao({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (parte / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 w-full min-w-[120px] overflow-hidden rounded-full bg-gray5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Participação do período no total do curso"
      >
        <div className="h-full rounded-full bg-darkPurple1" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-11 shrink-0 text-right text-sm font-semibold text-darkPurple1 tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

function ListaCursos({ cursos, sufixo }: { cursos: CursoAcademy[]; sufixo: string }) {
  return (
    <Table minWidth={1080}>
      <TableHeader>
        <TableRow>
          <TableHead>Curso</TableHead>
          <TableHead>Vendas · {sufixo}</TableHead>
          <TableHead>Total do curso</TableHead>
          <TableHead className="w-[30%]">Período sobre o total do curso</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cursos.map((c) => (
          <LinhaClicavel key={c.slug} href={`/vendas/cursos/${c.slug}`}>
            <TableCell className="max-w-[420px] whitespace-normal">
              <div className="flex flex-col items-start gap-1">
                <span className="font-bold text-purple-text">{c.nome}</span>
                <BadgeCategoria categoria={c.categoria} />
              </div>
            </TableCell>
            <TableCell>
              <ValorEQuantidade valor={c.valorPeriodo} vendas={c.vendasPeriodo} />
            </TableCell>
            <TableCell>
              <ValorEQuantidade valor={c.valorTotal} vendas={c.vendasTotal} />
            </TableCell>
            <TableCell>
              <BarraParticipacao parte={c.valorPeriodo} total={c.valorTotal} />
            </TableCell>
            <TableCell>
              <MdChevronRight className="size-[18px] text-gray3" />
            </TableCell>
          </LinhaClicavel>
        ))}
      </TableBody>
    </Table>
  );
}

/** Valor da venda; em pedido com mais de um curso, indica o rateio e o total do pedido. */
export function ValorVenda({ venda }: { venda: VendaAcademy }) {
  return (
    <div className="flex flex-col">
      <span className="font-bold text-darkPurple1">{formatarMoeda(venda.valorTotal)}</span>
      {venda.rateado && (
        <span className="text-xs text-gray3" title="Pedido com mais de um curso: valor rateado pelo ticket médio de cada curso">
          rateado · pedido de {formatarMoeda(venda.valorPedido)}
        </span>
      )}
    </div>
  );
}

export function Pessoa({ nome }: { nome: string | null }) {
  return nome ? <span className="text-gray2">{nome}</span> : <span className="text-gray3">—</span>;
}

// Comercial · Vendas no contexto Footure Academy: pedidos de venda da loja do
// Academy no Bling (cursos), da venda mais recente para a mais antiga.
export function TelaVendasAcademy({
  vendas,
  cursos,
  periodo,
  visao,
  contagens,
  sincronizadoEm,
  temCache,
}: {
  vendas: VendaAcademy[];
  cursos: CursoAcademy[];
  periodo: PeriodoVendasAcademy;
  visao: VisaoVendasAcademy;
  contagens: Record<PeriodoVendasAcademy, number>;
  sincronizadoEm: string | null;
  temCache: boolean;
}) {
  const porCategoria = (valor: (v: VendaAcademy) => number) => {
    const r = { especializacao: 0, livre: 0, hotmart: 0 };
    for (const v of vendas) r[v.categoria] += valor(v);
    return [
      { rotulo: "Cursos de Especialização", valor: r.especializacao },
      { rotulo: "Cursos Livres", valor: r.livre },
      // Hotmart: o Bling não traz o curso (só aparece quando houver venda no período).
      ...(r.hotmart > 0 ? [{ rotulo: "Hotmart (curso não identificado)", valor: r.hotmart }] : []),
    ];
  };
  const total = vendas.reduce((s, v) => s + v.valorTotal, 0);
  const sufixo = periodo === "mes" ? "mês" : periodo === "tri" ? "trimestre" : "12 meses";
  const aba = ABAS.find((a) => a.valor === periodo)!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial · Academy"
        titulo="Vendas"
        descricao="Vendas de cursos do Footure Academy — pedidos de venda da loja do Academy no Bling, da mais recente para a mais antiga."
        acoes={<IndicadorBling sincronizadoEm={sincronizadoEm} />}
      />

      {!temCache ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdSchool}
            titulo="Vendas do Academy ainda não sincronizadas"
            descricao="Use “Sincronizar Bling” no menu lateral para trazer os pedidos da loja do Academy."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <AbasFiltro
              valor={periodo}
              opcoes={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo, href: hrefVendas(a.valor, visao), contagem: contagens[a.valor] }))}
            />
          </div>

          <GradeKpis>
            <KpiCard
              rotulo={`Total de vendas · ${sufixo}`}
              valor={formatarMoedaCompacta(total)}
              apoio="valor total das vendas"
              rodape={<DivisaoValores partes={porCategoria((v) => v.valorTotal)} />}
            />
            <KpiCard
              rotulo={`Vendas · ${sufixo}`}
              valor={String(vendas.length)}
              apoio={vendas.length === 1 ? "venda" : "vendas"}
              rodape={<DivisaoValores partes={porCategoria(() => 1)} formatar={(n) => String(n)} />}
            />
          </GradeKpis>

          <SegmentedToggle
            valor={visao}
            opcoes={[
              { valor: "cursos", rotulo: `Cursos (${cursos.length})`, href: hrefVendas(periodo, "cursos") },
              { valor: "vendas", rotulo: `Vendas (${vendas.length})`, href: hrefVendas(periodo, "vendas") },
            ]}
          />

          {vendas.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio icone={MdSchool} titulo="Nenhuma venda no período" descricao={aba.vazio} />
            </div>
          ) : visao === "cursos" ? (
            <ListaCursos cursos={cursos} sufixo={sufixo} />
          ) : (
            <Table minWidth={1080}>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Data da venda</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Closer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((v) => (
                  <TableRow key={`${v.blingPedidoId}-${v.cursoSlug}`}>
                    <TableCell className="max-w-[280px] whitespace-normal">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-bold text-darkPurple1">{v.cliente}</span>
                        <span className="text-xs text-gray3">
                          {[v.documentoMascarado, `Pedido Bling nº ${v.numeroPedido}`].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-darkPurple1">{v.curso}</span>
                        {v.produto !== v.curso && <span className="text-xs text-gray3">Bling: {v.produto}</span>}
                        <BadgeCategoria categoria={v.categoria} />
                      </div>
                    </TableCell>
                    <TableCell className="text-gray2">{formatarDataCurta(v.dataVenda)}</TableCell>
                    <TableCell>
                      <ValorVenda venda={v} />
                    </TableCell>
                    <TableCell>
                      <Pessoa nome={v.sdr} />
                    </TableCell>
                    <TableCell>
                      <Pessoa nome={v.closer} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray3">
            Cursos: cursos gravados (janela de vendas aberta) não têm edição; nos demais, cada edição é um curso — pelo ano no nome do produto ou, sem ano, por ciclo de vendas (mês de início). Pedidos com mais de um curso têm o valor rateado pelo ticket médio de cada curso; a barra mostra quanto o valor vendido no período representa do total já vendido no curso. Data da venda = data do pedido no Bling; pedidos cancelados não entram. Especialização inclui a Certificação Executivo de Futebol. Vendas da Hotmart aparecem à parte (o Bling não traz o curso). Assinaturas (Silver/Gold, Footure Insights), mensalidades de cursos já vendidos e produtos que não são curso não contam como venda; a mesma venda lançada duas vezes no Bling conta uma só.
          </p>
        </>
      )}
    </div>
  );
}

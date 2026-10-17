import { MdSchool } from "react-icons/md";
import type { CategoriaVendaAcademy, PeriodoVendasAcademy, VendaAcademy } from "@/lib/academy/vendas";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { DivisaoValores, GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { IndicadorBling } from "@/components/financeiro/tela-contratos";

const ABAS: { valor: PeriodoVendasAcademy; rotulo: string; vazio: string }[] = [
  { valor: "mes", rotulo: "Mês atual", vazio: "Nenhuma venda neste mês." },
  { valor: "tri", rotulo: "Trimestre", vazio: "Nenhuma venda nos últimos 3 meses." },
  { valor: "12m", rotulo: "12 meses", vazio: "Nenhuma venda nos últimos 12 meses." },
];
const ROTULO_CATEGORIA: Record<CategoriaVendaAcademy, string> = { especializacao: "Especialização", livre: "Curso livre" };

function Pessoa({ nome }: { nome: string | null }) {
  return nome ? <span className="text-gray2">{nome}</span> : <span className="text-gray3">—</span>;
}

function formatarDocumento(doc: string | null) {
  if (doc?.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (doc?.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

// Comercial · Vendas no contexto Footure Academy: pedidos de venda da loja do
// Academy no Bling (cursos), da venda mais recente para a mais antiga.
export function TelaVendasAcademy({
  vendas,
  periodo,
  contagens,
  sincronizadoEm,
  temCache,
}: {
  vendas: VendaAcademy[];
  periodo: PeriodoVendasAcademy;
  contagens: Record<PeriodoVendasAcademy, number>;
  sincronizadoEm: string | null;
  temCache: boolean;
}) {
  const porCategoria = (valor: (v: VendaAcademy) => number) => {
    const r = { especializacao: 0, livre: 0 };
    for (const v of vendas) r[v.categoria] += valor(v);
    return [
      { rotulo: "Cursos de Especialização", valor: r.especializacao },
      { rotulo: "Cursos Livres", valor: r.livre },
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
              opcoes={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo, href: a.valor === "mes" ? "/vendas" : `/vendas?periodo=${a.valor}`, contagem: contagens[a.valor] }))}
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

          {vendas.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio icone={MdSchool} titulo="Nenhuma venda no período" descricao={aba.vazio} />
            </div>
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
                  <TableRow key={v.blingPedidoId}>
                    <TableCell className="max-w-[280px] whitespace-normal">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-bold text-darkPurple1">{v.cliente}</span>
                        <span className="text-xs text-gray3">
                          {[formatarDocumento(v.documento), `Pedido Bling nº ${v.numeroPedido}`].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-darkPurple1">{v.curso}</span>
                        <BadgeTom tom={v.categoria === "especializacao" ? "info" : "pending"}>{ROTULO_CATEGORIA[v.categoria]}</BadgeTom>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray2">{formatarDataCurta(v.dataVenda)}</TableCell>
                    <TableCell className="font-bold text-darkPurple1">{formatarMoeda(v.valorTotal)}</TableCell>
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
            Data da venda = data do pedido no Bling; pedidos cancelados não entram. Especialização inclui a Certificação Executivo de Futebol; assinaturas (Silver/Gold, Footure Insights) mensalidades de cursos já vendidos e produtos que não são curso não contam como venda.
          </p>
        </>
      )}
    </div>
  );
}

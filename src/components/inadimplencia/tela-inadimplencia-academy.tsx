import { MdCheckCircle, MdSync } from "react-icons/md";
import type { inadimplenciaAcademy } from "@/lib/academy/carteira";
import { ETAPAS_REGUA, etapaReguaSugerida } from "@/lib/inadimplencia/consultas";
import { statusAtrasoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, tempoDecorrido } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { ExportarCsv } from "@/components/inadimplencia/exportar-csv";
import { cn } from "@/lib/utils";

// Inadimplência no contexto Academy: parcelas vencidas das vendas de cursos
// (academy_parcelas), por comprador — mesma apresentação da tela do Footlink.
export function TelaInadimplenciaAcademy({
  dados: { clientes, faixas, resumo },
  temParcelas,
  sincronizadoEm,
}: {
  dados: ReturnType<typeof inadimplenciaAcademy>;
  temParcelas: boolean;
  sincronizadoEm: string | null;
}) {
  const maiorFaixa = Math.max(...faixas.map((f) => f.valor), 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro · Academy"
        titulo="Inadimplência"
        descricao="Parcelas vencidas das vendas de cursos, faixa de atraso e etapa da régua de cobrança de cada comprador."
        acoes={
          <>
            {sincronizadoEm && <span className="text-sm text-gray">Bling · {tempoDecorrido(sincronizadoEm)}</span>}
            <ExportarCsv
              nomeArquivo="inadimplencia-academy.csv"
              cabecalho={["Comprador", "Cursos", "Pedidos Bling", "Em atraso (R$)", "Parcelas vencidas", "Vencido desde", "Dias de atraso", "Etapa sugerida da régua"]}
              linhas={clientes.map((c) => [
                c.nome,
                c.cursos.join(" | "),
                c.pedidos.join(", "),
                c.totalAtrasado.toFixed(2).replace(".", ","),
                c.parcelasAtrasadas,
                formatarDataCurta(c.vencidoDesde),
                c.diasAtraso,
                etapaReguaSugerida(c.diasAtraso).rotulo,
              ])}
            />
          </>
        }
      />

      {!temParcelas ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdSync}
            titulo="Parcelas do Academy ainda não sincronizadas"
            descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral para trazer as contas a receber das vendas de cursos."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-stretch gap-5">
            <div className="grid grid-cols-2 gap-5">
              <KpiCard
                rotulo="Total vencido"
                valor={formatarMoeda(resumo.totalVencido)}
                corValor="text-red"
                apoio={`${resumo.parcelasVencidas} ${resumo.parcelasVencidas === 1 ? "parcela" : "parcelas"}`}
              />
              <KpiCard
                rotulo="Taxa de inadimplência"
                valor={`${(resumo.taxa * 100).toFixed(1).replace(".", ",")}%`}
                apoio={`do valor vendido já vencido (${formatarMoeda(resumo.totalJaVencido)})`}
              />
              <KpiCard rotulo="Compradores inadimplentes" valor={resumo.clientes} apoio={`de ${resumo.clientesComAberto} com parcelas em aberto`} />
              <KpiCard rotulo="A vencer" valor={formatarMoeda(resumo.totalAVencer)} apoio="parcelas em aberto ainda no prazo" />
            </div>

            <section className="flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card">
              <h2 className="text-lg font-bold text-darkPurple1">Valor vencido por faixa de atraso</h2>
              <ul className="flex flex-1 flex-col justify-center gap-3">
                {faixas.map((f) => (
                  <li key={f.rotulo} className="flex items-center gap-3 text-sm">
                    <span className="w-[76px] shrink-0 text-gray2">{f.rotulo}</span>
                    <span className="flex min-w-20 flex-1">
                      <span className={cn("h-[22px] rounded-md", f.cor)} style={{ width: `${Math.max((f.valor / maiorFaixa) * 100, f.valor > 0 ? 4 : 0)}%` }} />
                    </span>
                    <span className="w-[110px] shrink-0 text-right font-bold text-darkPurple1">{formatarMoeda(f.valor)}</span>
                    <span className="w-[90px] shrink-0 text-right text-xs text-gray3">
                      {f.clientes} {f.clientes === 1 ? "comprador" : "compradores"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {clientes.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio icone={MdCheckCircle} titulo="Nenhum comprador com parcela em atraso" descricao="Todas as parcelas vencidas das vendas de cursos foram recebidas." />
            </div>
          ) : (
            <Table minWidth={1000}>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Em atraso</TableHead>
                  <TableHead>Vencido desde</TableHead>
                  <TableHead>Dias ↑</TableHead>
                  <TableHead>Régua de cobrança (sugerida)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const atraso = statusAtrasoVisual(c.diasAtraso);
                  const regua = etapaReguaSugerida(c.diasAtraso);
                  return (
                    <LinhaClicavel key={c.contatoId} href={`/clientes/academy/${c.contatoId}`}>
                      <TableCell className="max-w-[360px] whitespace-normal">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-bold text-purple-text">{c.nome}</span>
                          <span className="text-xs text-gray3">{[c.documentoMascarado, c.cursos.join(" · ")].filter(Boolean).join(" · ")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-red">{formatarMoeda(c.totalAtrasado)}</span>
                          <span className="text-xs text-gray3">
                            {c.parcelasAtrasadas} {c.parcelasAtrasadas === 1 ? "parcela" : "parcelas"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray2">{formatarDataCurta(c.vencidoDesde)}</TableCell>
                      <TableCell>
                        <StatusPill tom={atraso.tom}>{atraso.rotulo}</StatusPill>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[13px] font-semibold text-darkPurple1">{regua.rotulo}</span>
                          <span className="flex gap-1" aria-hidden>
                            {ETAPAS_REGUA.map((e, i) => (
                              <span key={e.dias} className={cn("h-1 w-7 rounded-full", i <= regua.indice ? "bg-lightPurple1" : "bg-gray5")} />
                            ))}
                          </span>
                        </div>
                      </TableCell>
                    </LinhaClicavel>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray3">
            Parcelas das vendas de cursos no Bling (contas a receber dos pedidos). Vencida = em aberto com vencimento passado. Pedidos cancelados ou lançados em duplicidade não entram.
          </p>
        </>
      )}
    </div>
  );
}

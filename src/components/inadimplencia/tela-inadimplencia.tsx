import { MdCheckCircle, MdNotificationsActive, MdSync } from "react-icons/md";
import type { carregarInadimplencia, FiltroContratosInadimplencia } from "@/lib/inadimplencia/consultas";
import { ETAPAS_REGUA, etapaReguaSugerida } from "@/lib/inadimplencia/consultas";
import { statusAtrasoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, tempoDecorrido } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { AbasFiltro } from "@/components/ds/alternadores";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { ExportarCsv } from "@/components/inadimplencia/exportar-csv";
import { cn } from "@/lib/utils";

const SEM_BACKEND = "Em breve — depende da integração de cobrança";

function hrefCliente(clienteId: string | null, contatoId: number) {
  return clienteId ? `/clientes/${clienteId}` : `/clientes/bling/${contatoId}`;
}

// Tela "Inadimplência" do handoff (Financeiro) — só apresentação; os dados
// vêm prontos do cache do Bling (carregarInadimplencia).
export function TelaInadimplencia({
  dados: { temCache, sincronizadoEm, clientes, faixas, resumo },
  filtro,
  contagens,
  urlLogo,
}: {
  dados: Awaited<ReturnType<typeof carregarInadimplencia>>;
  filtro: FiltroContratosInadimplencia;
  /** Clientes inadimplentes em cada aba. */
  contagens: Record<FiltroContratosInadimplencia, number>;
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const maiorFaixa = Math.max(...faixas.map((f) => f.valor), 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro"
        titulo="Inadimplência"
        descricao="Parcelas vencidas, faixa de atraso e etapa da régua de cobrança de cada cliente."
        acoes={
          <>
            {sincronizadoEm && <span className="text-sm text-gray">Bling · {tempoDecorrido(sincronizadoEm)}</span>}
            <ExportarCsv
              nomeArquivo={filtro === "ativos" ? "inadimplencia-contratos-ativos.csv" : "inadimplencia.csv"}
              cabecalho={["Cliente", "Pedidos Bling", "Em atraso (R$)", "Parcelas vencidas", "Vencido desde", "Dias de atraso", "Etapa sugerida da régua"]}
              linhas={clientes.map((c) => [
                c.nome,
                c.pedidosBling.join(", "),
                c.totalAtrasado.toFixed(2).replace(".", ","),
                c.parcelasAtrasadas,
                formatarDataCurta(c.vencidoDesde),
                c.diasAtraso,
                etapaReguaSugerida(c.diasAtraso).rotulo,
              ])}
            />
            <Button disabled title={SEM_BACKEND}>
              <MdNotificationsActive className="size-[18px]" />
              Notificar todos
            </Button>
          </>
        }
      />

      {!temCache ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdSync}
            titulo="Parcelas do Bling ainda não sincronizadas"
            descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral para trazer as contas a receber do Bling — a primeira sincronização pode levar alguns minutos."
          />
        </div>
      ) : (
        <>
          <AbasFiltro
            valor={filtro}
            opcoes={[
              { valor: "ativos", rotulo: "Contratos ativos", href: "/inadimplencia", contagem: contagens.ativos },
              { valor: "todos", rotulo: "Todos os contratos", href: "/inadimplencia?contratos=todos", contagem: contagens.todos },
            ]}
          />

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
                apoio="do valor em aberto · sem meta definida"
              />
              <KpiCard rotulo="Clientes inadimplentes" valor={resumo.clientes} apoio={`de ${resumo.clientesAtivos} com parcelas em aberto`} />
              <KpiCard
                rotulo="Recuperado no mês"
                valor={resumo.recuperadoMes === null ? "—" : formatarMoeda(resumo.recuperadoMes)}
                corValor={resumo.recuperadoMes ? "text-green1" : undefined}
                apoio={
                  resumo.recuperadoMes === null
                    ? "aguardando a data de baixa do Bling (sincronize)"
                    : `${resumo.parcelasRecuperadas} ${resumo.parcelasRecuperadas === 1 ? "parcela paga" : "parcelas pagas"} em atraso neste mês`
                }
              />
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
                    <span className="w-[70px] shrink-0 text-right text-xs text-gray3">
                      {f.clientes} {f.clientes === 1 ? "cliente" : "clientes"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {clientes.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio
                icone={MdCheckCircle}
                titulo="Nenhum cliente com parcela em atraso"
                descricao={
                  filtro === "ativos"
                    ? "Nenhum contrato com vigência em curso tem parcela vencida."
                    : "Todas as cobranças vencidas sincronizadas do Bling foram recebidas."
                }
              />
            </div>
          ) : (
            <Table minWidth={1000}>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Em atraso</TableHead>
                  <TableHead>Vencido desde</TableHead>
                  <TableHead>Dias ↓</TableHead>
                  <TableHead>Régua de cobrança (sugerida)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const atraso = statusAtrasoVisual(c.diasAtraso);
                  const regua = etapaReguaSugerida(c.diasAtraso);
                  return (
                    <LinhaClicavel key={c.contatoId} href={hrefCliente(c.clienteId, c.contatoId)}>
                      <TableCell className="max-w-[300px] whitespace-normal">
                        <div className="flex items-center gap-3">
                          <LogoCliente url={urlLogo(c.logoPath)} nome={c.nome} />
                          <div className="flex min-w-0 flex-col">
                            <span className="font-bold text-purple-text">{c.nome}</span>
                            <span className="text-xs text-gray3">
                              Footlink{c.pedidosBling.length ? ` · pedido${c.pedidosBling.length > 1 ? "s" : ""} ${c.pedidosBling.join(", ")}` : ""}
                            </span>
                          </div>
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
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" disabled title={SEM_BACKEND}>
                            Notificar
                          </Button>
                          <Button size="sm" variant="white" disabled title={SEM_BACKEND}>
                            Renegociar
                          </Button>
                        </div>
                      </TableCell>
                    </LinhaClicavel>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

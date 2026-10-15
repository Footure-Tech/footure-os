import { MdChevronRight, MdDescription, MdSync } from "react-icons/md";
import type { carregarContratos, FiltroContratos } from "@/lib/financeiro/carteira";
import { contratoNoFiltro } from "@/lib/financeiro/carteira";
import { STATUS_CONTRATO_VISUAL } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta, tempoDecorrido } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";

const ABAS: { valor: FiltroContratos; rotulo: string }[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "vencem_3_meses", rotulo: "Vencem em menos de 3 meses" },
  { valor: "inativos", rotulo: "Inativos" },
  { valor: "cancelados", rotulo: "Cancelados" },
];

const DESCRICAO_VAZIO: Record<FiltroContratos, string> = {
  ativos: "Nenhum contrato com parcelas a receber.",
  vencem_3_meses: "Nenhum contrato ativo termina nos próximos 3 meses.",
  inativos: "Nenhum contrato concluído (todas as parcelas recebidas).",
  cancelados: "Nenhum pedido de venda cancelado no Bling.",
};

function hrefCliente(clienteId: string | null, contatoId: number) {
  return clienteId ? `/clientes/${clienteId}` : `/clientes/bling/${contatoId}`;
}

export function IndicadorBling({ sincronizadoEm }: { sincronizadoEm: string | null }) {
  return (
    <span className="flex items-center gap-2 text-sm text-gray">
      <span className={sincronizadoEm ? "size-2 rounded-full bg-green2" : "size-2 rounded-full bg-gray3"} />
      Bling · {sincronizadoEm ? tempoDecorrido(sincronizadoEm) : "nunca sincronizado"}
    </span>
  );
}

export function AvisoSemCache() {
  return (
    <div className="rounded-xl border border-gray5 bg-surface shadow-table">
      <EstadoVazio
        icone={MdSync}
        titulo="Dados do Bling ainda não sincronizados"
        descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral — a primeira sincronização pode levar alguns minutos."
      />
    </div>
  );
}

// Tela Financeiro · Contratos — um contrato = um pedido de venda do Bling.
export function TelaContratos({
  dados: { contratos, resumo, sincronizadoEm, temCache },
  filtro,
  urlLogo,
}: {
  dados: Awaited<ReturnType<typeof carregarContratos>>;
  filtro: FiltroContratos;
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const visiveis = contratos.filter((c) => contratoNoFiltro(c, filtro));
  const pctExecutado = resumo.paraExecucao > 0 ? Math.round((resumo.executado / resumo.paraExecucao) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro"
        titulo="Contratos"
        descricao="Pedidos de venda do Bling — vigência, execução e situação de cada contrato."
        acoes={<IndicadorBling sincronizadoEm={sincronizadoEm} />}
      />

      {!temCache ? (
        <AvisoSemCache />
      ) : (
        <>
          <GradeKpis>
            <KpiCard
              rotulo={`Total contratado · ${resumo.ano}`}
              valor={formatarMoedaCompacta(resumo.totalContratado)}
              destaque={`${resumo.contratosNoAno} ${resumo.contratosNoAno === 1 ? "contrato" : "contratos"}`}
              apoio={`iniciados em ${resumo.ano}`}
            />
            <KpiCard
              rotulo={`Para execução · ${resumo.ano}`}
              valor={formatarMoedaCompacta(resumo.paraExecucao)}
              apoio={`parcelas com vencimento em ${resumo.ano}`}
            />
            <KpiCard
              rotulo={`Executado · ${resumo.ano}`}
              valor={formatarMoedaCompacta(resumo.executado)}
              corValor="text-green1"
              destaque={`${pctExecutado}%`}
              tomDestaque="positivo"
              apoio="do valor para execução (pago)"
            />
            <KpiCard
              rotulo={`A executar · ${resumo.ano}`}
              valor={formatarMoedaCompacta(resumo.aExecutar)}
              apoio="em aberto ou atrasado"
            />
          </GradeKpis>

          <AbasFiltro
            valor={filtro}
            opcoes={ABAS.map((a) => ({
              valor: a.valor,
              rotulo: a.rotulo,
              href: `/financeiro?filtro=${a.valor}`,
              contagem: contratos.filter((c) => contratoNoFiltro(c, a.valor)).length,
            }))}
          />

          {visiveis.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio icone={MdDescription} titulo="Nenhum contrato neste filtro" descricao={DESCRICAO_VAZIO[filtro]} />
            </div>
          ) : (
            <Table minWidth={960}>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Parcelas pagas</TableHead>
                  <TableHead>Próx. venc.</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((c) => {
                  const situacao = STATUS_CONTRATO_VISUAL[c.situacao];
                  return (
                    <LinhaClicavel key={c.pedidoId} href={hrefCliente(c.clienteId, c.contatoId)}>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        <div className="flex items-center gap-3">
                          <LogoCliente url={urlLogo(c.logoPath)} nome={c.cliente} />
                          <div className="flex min-w-0 flex-col">
                            <span className="font-bold text-purple-text">{c.cliente}</span>
                            <span className="text-xs text-gray3">Pedido Bling nº {c.numeroPedido}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray2">
                        {c.inicio ? formatarDataCurta(c.inicio) : "—"} a {c.fim ? formatarDataCurta(c.fim) : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-darkPurple1">{formatarMoeda(c.valorTotal)}</TableCell>
                      <TableCell>{c.totalParcelas > 0 ? <BarraProgresso feito={c.pagas} total={c.totalParcelas} /> : <span className="text-gray3">—</span>}</TableCell>
                      <TableCell className="text-gray2">{c.proximoVencimento ? formatarDataCurta(c.proximoVencimento) : "—"}</TableCell>
                      <TableCell>
                        <StatusPill tom={situacao.tom}>{situacao.rotulo}</StatusPill>
                      </TableCell>
                      <TableCell>
                        <MdChevronRight className="size-[18px] text-gray3" />
                      </TableCell>
                    </LinhaClicavel>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray3">
            Vigência = data do pedido até o vencimento da última parcela. A execução do ano considera as parcelas que vencem no ano; parcelas pagas só em
            parte contam como “a executar”.
          </p>
        </>
      )}
    </div>
  );
}

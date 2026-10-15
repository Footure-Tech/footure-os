import Link from "next/link";
import { MdAttachMoney, MdChevronLeft, MdChevronRight } from "react-icons/md";
import type { carregarPagamentos, StatusPagamento } from "@/lib/financeiro/carteira";
import { STATUS_PARCELA_VISUAL } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { AvisoSemCache, IndicadorBling } from "@/components/financeiro/tela-contratos";
import { FiltroStatusPagamento } from "@/components/financeiro/filtro-status-pagamento";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-10" ± n meses. */
export function deslocarMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hrefCliente(clienteId: string | null, contatoId: number) {
  return clienteId ? `/clientes/${clienteId}` : `/clientes/bling/${contatoId}`;
}

// Navegação por mês (‹ Outubro de 2026 ›); o mês corrente é o padrão.
function NavegadorMes({ mes, mesAtual, status }: { mes: string; mesAtual: string; status: StatusPagamento[] }) {
  const [ano, m] = mes.split("-").map(Number);
  const href = (alvo: string) => `/financeiro/pagamentos?mes=${alvo}${status.length ? `&status=${status.join(",")}` : ""}`;
  const botao =
    "flex size-[38px] items-center justify-center rounded-lg border border-gray5 bg-surface text-darkPurple1 transition-all duration-200 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none";
  return (
    <div className="flex items-center gap-2">
      {mes !== mesAtual && (
        <Link href={href(mesAtual)} className="mr-1 text-sm font-semibold text-purple-text hover:underline">
          Mês atual
        </Link>
      )}
      <Link href={href(deslocarMes(mes, -1))} aria-label="Mês anterior" title="Mês anterior" className={botao}>
        <MdChevronLeft className="size-5" />
      </Link>
      <span className="min-w-[150px] text-center text-base font-bold text-darkPurple1">
        {MESES[m - 1]} de {ano}
      </span>
      <Link href={href(deslocarMes(mes, 1))} aria-label="Próximo mês" title="Próximo mês" className={botao}>
        <MdChevronRight className="size-5" />
      </Link>
    </div>
  );
}

// Tela Financeiro · Pagamentos — parcelas do Bling com vencimento no mês escolhido.
export function TelaPagamentos({
  dados: { parcelas, resumo, sincronizadoEm, temCache },
  mes,
  mesAtual,
  status,
}: {
  dados: Awaited<ReturnType<typeof carregarPagamentos>>;
  mes: string;
  mesAtual: string;
  /** Status selecionados no filtro; vazio = todos. */
  status: StatusPagamento[];
}) {
  const nomeMes = MESES[Number(mes.slice(5, 7)) - 1].toLowerCase();
  const visiveis = status.length ? parcelas.filter((p) => status.includes(p.status)) : parcelas;
  const pctRecebido = resumo.previsto > 0 ? Math.round((resumo.recebido / resumo.previsto) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro"
        titulo="Pagamentos"
        descricao="Parcelas dos contratos sincronizadas com o Bling, mês a mês."
        acoes={
          <>
            <IndicadorBling sincronizadoEm={sincronizadoEm} />
            <NavegadorMes mes={mes} mesAtual={mesAtual} status={status} />
          </>
        }
      />

      {!temCache ? (
        <AvisoSemCache />
      ) : (
        <>
          <GradeKpis>
            <KpiCard
              rotulo="Previsto para o mês"
              valor={formatarMoedaCompacta(resumo.previsto)}
              destaque={`${resumo.quantidade} ${resumo.quantidade === 1 ? "parcela" : "parcelas"}`}
              apoio={`vencem em ${nomeMes}`}
            />
            <KpiCard
              rotulo="Recebido no mês"
              valor={formatarMoedaCompacta(resumo.recebido)}
              corValor="text-green1"
              destaque={`${pctRecebido}%`}
              tomDestaque="positivo"
              apoio="do previsto"
            />
            <KpiCard rotulo="A receber no mês" valor={formatarMoedaCompacta(resumo.aReceber)} apoio="previsto e em aberto" />
            <KpiCard rotulo="Vencido no mês" valor={formatarMoedaCompacta(resumo.vencido)} corValor="text-red" apoio="previsto e atrasado" />
          </GradeKpis>

          <div className="flex flex-wrap items-center gap-2.5">
            <FiltroStatusPagamento mes={mes} selecionados={status} />
            <span className="ml-auto text-sm text-gray3">
              {visiveis.length} de {parcelas.length} parcelas
            </span>
          </div>

          {visiveis.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio
                icone={MdAttachMoney}
                titulo={parcelas.length === 0 ? `Nenhuma parcela com vencimento em ${nomeMes}` : "Nenhuma parcela com esse status"}
                descricao={parcelas.length === 0 ? "Use as setas para ver outro mês." : "Ajuste o filtro de status para ver as demais parcelas do mês."}
              />
            </div>
          ) : (
            <Table minWidth={900}>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pedido Bling</TableHead>
                  <TableHead>ID Bling</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((p) => {
                  const s = STATUS_PARCELA_VISUAL[p.situacao];
                  return (
                    <LinhaClicavel key={p.id} href={hrefCliente(p.clienteId, p.contatoId)}>
                      <TableCell className="max-w-[280px] font-bold whitespace-normal text-purple-text">{p.cliente}</TableCell>
                      <TableCell className="text-gray2">
                        {p.numero}/{p.totalDoPedido}
                      </TableCell>
                      <TableCell className="text-gray2">{formatarDataCurta(p.vencimento)}</TableCell>
                      <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor)}</TableCell>
                      <TableCell className="text-gray2">{p.numeroPedidoOrigem ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-gray3">{p.id}</TableCell>
                      <TableCell>
                        <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
                      </TableCell>
                    </LinhaClicavel>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray3">
            Parcelas pagas só em parte aparecem como “Paga parcial” e contam em “A receber” (ainda têm saldo). Parcelas de pedidos cancelados no Bling não
            entram.
          </p>
        </>
      )}
    </div>
  );
}

import { MdAttachMoney, MdChevronRight, MdSync } from "react-icons/md";
import type { carregarCarteira } from "@/lib/financeiro/carteira";
import { STATUS_PARCELA_VISUAL, statusCarteiraVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, tempoDecorrido } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { SincronizarBlingButton } from "@/components/clientes/sincronizar-bling-button";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function hrefCliente(clienteId: string | null, contatoId: number) {
  return clienteId ? `/clientes/${clienteId}` : `/clientes/bling/${contatoId}`;
}

function BarraProgresso({ feito, total }: { feito: number; total: number }) {
  const pct = total > 0 ? Math.round((feito / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray5">
        <span className="block h-full rounded-full bg-green2" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[13px] font-semibold text-gray2">
        {feito}/{total}
      </span>
    </div>
  );
}

// Tela "Contratos e parcelas" do handoff (Financeiro) — só apresentação; os
// dados vêm prontos do cache do Bling (carregarCarteira, em app/financeiro).
export function TelaFinanceiro({
  dados: { resumo, carteira, parcelasDoMes, sincronizadoEm, temCache },
  urlLogo,
}: {
  dados: Awaited<ReturnType<typeof carregarCarteira>>;
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const pctRecebido = resumo.previstoMes > 0 ? Math.round((resumo.recebidoMes / resumo.previstoMes) * 100) : 0;
  const mesAtual = MESES[new Date().getMonth()];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro"
        titulo="Contratos e parcelas"
        descricao="Carteira de contratos assinados e cobranças sincronizadas com o Bling."
        acoes={
          <>
            <span className="flex items-center gap-2 text-sm text-gray">
              <span className={sincronizadoEm ? "size-2 rounded-full bg-green2" : "size-2 rounded-full bg-gray3"} />
              Bling · {sincronizadoEm ? tempoDecorrido(sincronizadoEm) : "nunca sincronizado"}
            </span>
            <SincronizarBlingButton />
          </>
        }
      />

      {!temCache ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdSync}
            titulo="Parcelas do Bling ainda não sincronizadas"
            descricao="Clique em “Sincronizar” para trazer as contas a receber do Bling — a primeira sincronização pode levar alguns minutos."
          />
        </div>
      ) : (
        <>
          <GradeKpis>
            <KpiCard rotulo="Carteira ativa" valor={formatarMoeda(resumo.carteiraAtiva)} destaque={`${resumo.clientesAtivos} clientes`} apoio="com parcelas a vencer" />
            <KpiCard rotulo="A receber (mês)" valor={formatarMoeda(resumo.aReceberMes)} apoio={`em aberto com vencimento em ${mesAtual}`} />
            <KpiCard
              rotulo="Recebido (mês)"
              valor={formatarMoeda(resumo.recebidoMes)}
              corValor="text-green1"
              destaque={`${pctRecebido}%`}
              tomDestaque="positivo"
              apoio={`do previsto (${formatarMoeda(resumo.previstoMes)})`}
            />
            <KpiCard
              rotulo="Vencido"
              valor={formatarMoeda(resumo.vencido)}
              corValor="text-red"
              destaque={`${resumo.clientesComVencido} ${resumo.clientesComVencido === 1 ? "cliente" : "clientes"}`}
              tomDestaque="negativo"
              apoio="com parcelas em atraso"
            />
          </GradeKpis>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-darkPurple1">Carteira de contratos</h2>
            <p className="-mt-2 text-sm text-gray">Por cliente — o vínculo de cada parcela com o contrato chega com a integração do pedido com o Bling.</p>
            {carteira.length === 0 ? (
              <div className="rounded-xl border border-gray5 bg-surface shadow-table">
                <EstadoVazio compacto icone={MdAttachMoney} titulo="Nenhum cliente com parcelas a receber" descricao="Todas as cobranças sincronizadas já foram recebidas." />
              </div>
            ) : (
              <Table minWidth={900}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Parcelas pagas</TableHead>
                    <TableHead>Próx. venc.</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carteira.map((c) => {
                    const situacao = statusCarteiraVisual(c.atrasado);
                    return (
                      <LinhaClicavel key={c.contatoId} href={hrefCliente(c.clienteId, c.contatoId)}>
                        <TableCell className="max-w-[300px] whitespace-normal">
                          <div className="flex items-center gap-3">
                            <LogoCliente url={urlLogo(c.logoPath)} nome={c.nome} />
                            <span className="font-bold text-purple-text">{c.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BadgeLinha />
                        </TableCell>
                        <TableCell className="font-bold text-darkPurple1">{formatarMoeda(c.valorTotal)}</TableCell>
                        <TableCell>
                          <BarraProgresso feito={c.pagas} total={c.total} />
                        </TableCell>
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
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-darkPurple1">Parcelas de {mesAtual}</h2>
            {parcelasDoMes.length === 0 ? (
              <div className="rounded-xl border border-gray5 bg-surface shadow-table">
                <EstadoVazio compacto icone={MdAttachMoney} titulo="Nenhuma parcela com vencimento neste mês" />
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
                  {parcelasDoMes.map((p) => {
                    const status = STATUS_PARCELA_VISUAL[p.situacao];
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
                          <StatusPill tom={status.tom}>{status.rotulo}</StatusPill>
                        </TableCell>
                      </LinhaClicavel>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

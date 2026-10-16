import { MdChevronRight, MdTrendingUp } from "react-icons/md";
import type { PeriodoVendas, Venda } from "@/lib/vendas/consultas";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { AvisoSemCache, IndicadorBling } from "@/components/financeiro/tela-contratos";

const ABAS: { valor: PeriodoVendas; rotulo: string; vazio: string }[] = [
  { valor: "mes", rotulo: "Mês atual", vazio: "Nenhuma venda fechada neste mês." },
  { valor: "tri", rotulo: "Trimestre", vazio: "Nenhuma venda fechada nos últimos 3 meses." },
  { valor: "12m", rotulo: "12 meses", vazio: "Nenhuma venda fechada nos últimos 12 meses." },
];
const ROTULO_TIPO = { clube: "Clube", agente: "Agente" } as const;

function Pessoa({ nome }: { nome: string | null }) {
  return nome ? <span className="text-gray2">{nome}</span> : <span className="text-gray3" title="Não informado — defina na tela do contrato">—</span>;
}

// Tela Comercial · Vendas: vendas (pedidos de venda do Bling) do período, da mais recente para a mais antiga.
export function TelaVendas({
  vendas,
  periodo,
  contagens,
  sincronizadoEm,
  temCache,
  urlLogo,
}: {
  vendas: Venda[];
  periodo: PeriodoVendas;
  contagens: Record<PeriodoVendas, number>;
  sincronizadoEm: string | null;
  temCache: boolean;
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const total = vendas.reduce((s, v) => s + v.valorTotal, 0);
  const aba = ABAS.find((a) => a.valor === periodo)!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial"
        titulo="Vendas"
        descricao="Vendas fechadas — pedidos de venda do Bling, da mais recente para a mais antiga."
        acoes={<IndicadorBling sincronizadoEm={sincronizadoEm} />}
      />

      {!temCache ? (
        <AvisoSemCache />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <AbasFiltro
              valor={periodo}
              opcoes={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo, href: a.valor === "mes" ? "/vendas" : `/vendas?periodo=${a.valor}`, contagem: contagens[a.valor] }))}
            />
            {vendas.length > 0 && (
              <span className="ml-auto text-sm text-gray3">
                {vendas.length} {vendas.length === 1 ? "venda" : "vendas"} · <strong className="font-bold text-darkPurple1">{formatarMoedaCompacta(total)}</strong>
              </span>
            )}
          </div>

          {vendas.length === 0 ? (
            <div className="rounded-xl border border-gray5 bg-surface shadow-table">
              <EstadoVazio icone={MdTrendingUp} titulo="Nenhuma venda no período" descricao={aba.vazio} />
            </div>
          ) : (
            <Table minWidth={1080}>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead>1ª parcela</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((v) => (
                  <LinhaClicavel key={v.blingPedidoId} href={`/financeiro/contratos/${v.blingPedidoId}`}>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      <div className="flex items-center gap-3">
                        <LogoCliente url={urlLogo(v.logoPath)} nome={v.cliente} />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-bold text-purple-text">{v.cliente}</span>
                          <span className="text-xs text-gray3">Pedido Bling nº {v.numeroPedido}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{v.tipo ? <BadgeTom tom={v.tipo === "clube" ? "info" : "pending"}>{ROTULO_TIPO[v.tipo]}</BadgeTom> : <span className="text-gray3">—</span>}</TableCell>
                    <TableCell className="text-gray2">{formatarDataCurta(v.dataFechamento)}</TableCell>
                    <TableCell className="text-gray2">{v.primeiraParcela ? formatarDataCurta(v.primeiraParcela) : "—"}</TableCell>
                    <TableCell className="font-bold text-darkPurple1">{formatarMoeda(v.valorTotal)}</TableCell>
                    <TableCell>
                      <Pessoa nome={v.sdr} />
                    </TableCell>
                    <TableCell>
                      <Pessoa nome={v.closer} />
                    </TableCell>
                    <TableCell>
                      <MdChevronRight className="size-[18px] text-gray3" />
                    </TableCell>
                  </LinhaClicavel>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray3">
            Fechamento = data do pedido de venda no Bling; pedidos cancelados não entram. SDR e Closer são definidos na tela do contrato (ou vêm do pedido, quando a venda foi fechada pela plataforma).
          </p>
        </>
      )}
    </div>
  );
}

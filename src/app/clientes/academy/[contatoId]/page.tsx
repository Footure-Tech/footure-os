import Link from "next/link";
import { notFound } from "next/navigation";
import { MdReceiptLong, MdSchool } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { carregarCarteiraAcademy, compradoresAcademy } from "@/lib/academy/carteira";
import { resumirPagamentos } from "@/lib/academy/vendas";
import { dataCurta } from "@/lib/academy/series";
import { STATUS_PARCELA_VISUAL } from "@/lib/status/visual";
import { formatarMoeda } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo } from "@/components/negocio/card-modulo";
import { BadgeCategoria, ValorVenda } from "@/components/vendas/tela-vendas-academy";

const SITUACAO_VENDA = {
  atendido: { rotulo: "Atendido", tom: "active" },
  em_aberto: { rotulo: "Em aberto", tom: "pending" },
  cancelado: { rotulo: "Cancelado", tom: "inactive" },
} as const;

// Comercial · Academy · Cliente: totais, todos os cursos comprados (canceladas
// marcadas) e as parcelas de um comprador.
export default async function ClienteAcademyPage({ params }: PageProps<"/clientes/academy/[contatoId]">) {
  const contatoId = Number((await params).contatoId);
  const supabase = await createClient();
  const carteira = await carregarCarteiraAcademy(supabase);
  const comprador = compradoresAcademy(carteira).find((c) => c.contatoId === contatoId);
  if (!comprador) notFound();
  const compras = carteira.todas.filter((v) => v.contatoId === contatoId);
  const numeroDoPedido = new Map(compras.map((v) => [v.blingPedidoId, v.numeroPedido]));
  const parcelas = carteira.parcelas.filter((p) => p.contatoId === contatoId).sort((a, b) => b.vencimento.localeCompare(a.vencimento));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial · Academy · Cliente"
        titulo={comprador.nome}
        descricao={[comprador.documentoMascarado, `cliente desde ${dataCurta(comprador.primeiraCompra)}`].filter(Boolean).join(" · ")}
        voltarHref="/clientes"
      />

      <GradeKpis>
        <KpiCard
          rotulo="Total comprado (bruto)"
          valor={formatarMoeda(comprador.totalComprado)}
          apoio={`${comprador.cursos.length} ${comprador.cursos.length === 1 ? "curso" : "cursos"}`}
        />
        <KpiCard
          rotulo="Total líquido"
          valor={formatarMoeda(comprador.totalLiquido)}
          corValor="text-green1"
          apoio="após taxas de pagamento e impostos (13%)"
        />
        <KpiCard
          rotulo="Compras realizadas"
          valor={String(comprador.compras)}
          apoio={comprador.compras > 1 ? `de ${dataCurta(comprador.primeiraCompra)} a ${dataCurta(comprador.ultimaCompra)}` : `em ${dataCurta(comprador.ultimaCompra)}`}
        />
        <KpiCard
          rotulo="Em atraso"
          valor={formatarMoeda(comprador.emAtraso)}
          corValor={comprador.emAtraso > 0 ? "text-red" : undefined}
          apoio={
            comprador.parcelasAtrasadas
              ? `${comprador.parcelasAtrasadas} ${comprador.parcelasAtrasadas === 1 ? "parcela vencida" : "parcelas vencidas"}`
              : comprador.emAberto > 0
                ? `${formatarMoeda(comprador.emAberto)} a vencer`
                : "nenhuma parcela em aberto"
          }
        />
      </GradeKpis>

      <CardModulo icone={MdSchool} cor="bg-iconBlue" titulo={`Cursos comprados (${compras.length})`} className="min-w-0">
        <Table minWidth={860}>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras.map((v) => (
              <TableRow key={`${v.blingPedidoId}-${v.cursoSlug}`} className={v.situacao === "cancelado" ? "opacity-60" : undefined}>
                <TableCell className="text-gray2">{dataCurta(v.dataVenda)}</TableCell>
                <TableCell className="max-w-[380px] whitespace-normal">
                  <div className="flex flex-col items-start gap-1">
                    <Link href={`/vendas/cursos/${v.cursoSlug}`} className="font-semibold text-purple-text hover:underline">
                      {v.curso}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-gray3">
                      <BadgeCategoria categoria={v.categoria} />
                      Pedido nº {v.numeroPedido}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <ValorVenda venda={v} />
                </TableCell>
                <TableCell className="text-gray2">{resumirPagamentos(v.pagamentos)}</TableCell>
                <TableCell>
                  <BadgeTom tom={SITUACAO_VENDA[v.situacao].tom}>{SITUACAO_VENDA[v.situacao].rotulo}</BadgeTom>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardModulo>

      <CardModulo icone={MdReceiptLong} cor="bg-iconGreen" titulo="Parcelas" className="min-w-0">
        {parcelas.length === 0 ? (
          <EstadoVazio compacto icone={MdReceiptLong} titulo="Nenhuma parcela no Bling" descricao="As contas a receber das compras aparecem aqui depois da sincronização." />
        ) : (
          <Table minWidth={600}>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-gray2">{dataCurta(p.vencimento)}</TableCell>
                  <TableCell className="font-semibold text-darkPurple1">{formatarMoeda(p.valor)}</TableCell>
                  <TableCell className="text-gray2">nº {numeroDoPedido.get(p.blingPedidoId) ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill tom={STATUS_PARCELA_VISUAL[p.situacao].tom}>{STATUS_PARCELA_VISUAL[p.situacao].rotulo}</StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardModulo>
    </div>
  );
}

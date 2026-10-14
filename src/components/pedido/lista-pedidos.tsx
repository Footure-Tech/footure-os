import { MdChevronRight, MdReceipt } from "react-icons/md";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { ABAS_PEDIDOS, statusNaAba, type AbaPedidos } from "@/lib/pedidos/abas";
import { statusPedidoVisual } from "@/lib/status/visual";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { formatarDataCurta, formatarMoeda, rotuloPagamento } from "@/lib/formatacao";
import type { listarPedidosDeVenda } from "@/lib/pedidos/consultas";

type PedidoListado = Awaited<ReturnType<typeof listarPedidosDeVenda>>[number];

const ROTULO_PERFIL_CLIENTE = { clube: "Clube", agente: "Agente" } as const;

// Tabela "Pedidos de venda" do handoff + abas de filtro por status (na URL,
// ?aba=). A linha inteira abre o detalhe do pedido.
export function ListaPedidos({
  pedidos,
  aba,
  caminho,
  urlLogo,
}: {
  pedidos: PedidoListado[];
  aba: AbaPedidos;
  caminho: string;
  /** URL pública do logo do cliente (urlLogoCliente, já com o client da página). */
  urlLogo: (logoPath: string | null) => string | null;
}) {
  const filtrados = pedidos.filter((p) => statusNaAba(aba, p.status));
  const opcoes = ABAS_PEDIDOS.map((a) => ({
    valor: a.valor,
    rotulo: a.rotulo,
    href: `${caminho}?aba=${a.valor}`,
    contagem: pedidos.filter((p) => statusNaAba(a.valor, p.status)).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <AbasFiltro opcoes={opcoes} valor={aba} />

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdReceipt}
            titulo={pedidos.length === 0 ? "Nenhum pedido de venda ainda" : "Nenhum pedido nesta etapa"}
            descricao={pedidos.length === 0 ? "Use “Novo pedido” para registrar a primeira venda." : "Escolha outra aba para ver os demais pedidos."}
          />
        </div>
      ) : (
        <Table minWidth={960}>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto · Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => {
              const cliente = p.clientes as unknown as { razao_social: string; nome_fantasia: string | null; logo_path: string | null } | null;
              const nomeCliente = cliente?.nome_fantasia || cliente?.razao_social || "—";
              const vendedor = (p.profiles as unknown as { nome: string } | null)?.nome;
              const status = statusPedidoVisual(p.status, p.geracao_contrato_erro);
              return (
                <LinhaClicavel key={p.id} href={`/pedidos/${p.id}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      {/* Nº do pedido vem do Bling (decisão de produto); o envio ao Bling ainda é stub, então fica pendente. */}
                      <span className="font-bold text-darkPurple1" title="Número atribuído pelo Bling quando o pedido for enviado">
                        —
                      </span>
                      <span className="text-xs text-gray3">{formatarDataCurta(p.criado_em)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal">
                    <div className="flex items-center gap-3">
                      <LogoCliente url={urlLogo(cliente?.logo_path ?? null)} nome={nomeCliente} />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-bold text-purple-text">{nomeCliente}</span>
                        <span className="text-xs text-gray3">
                          {ROTULO_PERFIL_CLIENTE[p.perfil]}
                          {vendedor ? ` · ${vendedor}` : ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BadgeLinha />
                      <span className="text-[13px] text-gray2">{buscarPlanoPorKey(p.plano)?.canonical ?? p.plano}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor_total)}</TableCell>
                  <TableCell className="text-gray2">{rotuloPagamento(p.forma_pagamento, p.meio_pagamento, p.numero_parcelas)}</TableCell>
                  <TableCell>
                    <StatusPill tom={status.tom}>{status.rotulo}</StatusPill>
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
    </div>
  );
}

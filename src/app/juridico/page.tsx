import { MdChevronRight, MdGavel } from "react-icons/md";
import { exigirPapel } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listarContratosJuridico } from "@/lib/pedidos/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { ITENS_VALIDACAO } from "@/lib/contratos/validacao";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { statusPedidoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import type { StatusPedido } from "@/lib/supabase/database.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";

const ABAS = [
  { valor: "todos", rotulo: "Todos", status: null },
  { valor: "geracao", rotulo: "Em geração", status: ["aprovado"] },
  { valor: "validacao", rotulo: "Em validação", status: ["em_revisao_juridica", "pronto_para_assinatura"] },
  { valor: "assinatura", rotulo: "Aguardando assinatura", status: ["enviado_para_assinatura"] },
  { valor: "assinados", rotulo: "Assinados", status: ["assinado", "concluido"] },
] as const satisfies readonly { valor: string; rotulo: string; status: readonly StatusPedido[] | null }[];
type Aba = (typeof ABAS)[number]["valor"];

function naAba(aba: Aba, status: StatusPedido) {
  const def = ABAS.find((a) => a.valor === aba)!;
  return def.status === null || (def.status as readonly StatusPedido[]).includes(status);
}

// Jurídico · Assinatura de contratos — lista dos pedidos de venda com contrato;
// cada linha abre o detalhe do pedido, onde o jurídico vê todos os dados do
// pedido e do cliente, valida (checklist), sobe versões e libera a assinatura.
export default async function ContratosJuridicoPage({ searchParams }: PageProps<"/juridico">) {
  await exigirPapel("juridico", "admin");
  const { aba: abaParam } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === abaParam) ? (abaParam as Aba) : "todos";
  const supabase = await createClient();

  const todos = (await listarContratosJuridico(supabase)).map((p) => {
    const versoes = (p.contratos as unknown as { id: string; versao: number; gerado_em: string }[] | null) ?? [];
    return { ...p, contrato: versoes.reduce<(typeof versoes)[number] | null>((maior, c) => (!maior || c.versao > maior.versao ? c : maior), null) };
  });
  const filtrados = todos.filter((p) => naAba(aba, p.status));

  // Progresso do checklist de validação da versão atual de cada contrato.
  const idsContratos = filtrados.map((p) => p.contrato?.id).filter((id): id is string => !!id);
  const { data: marcacoes } = idsContratos.length
    ? await supabase.from("contrato_validacao").select("contrato_id").in("contrato_id", idsContratos)
    : { data: [] };
  const marcadosPorContrato = new Map<string, number>();
  for (const m of marcacoes ?? []) marcadosPorContrato.set(m.contrato_id, (marcadosPorContrato.get(m.contrato_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Jurídico"
        titulo="Assinatura de contratos"
        descricao="Pedidos de venda com contrato — abra um pedido para ver todos os dados, validar o contrato e liberar a assinatura via Clicksign."
      />

      <AbasFiltro
        valor={aba}
        opcoes={ABAS.map((a) => ({
          valor: a.valor,
          rotulo: a.rotulo,
          href: a.valor === "todos" ? "/juridico" : `/juridico?aba=${a.valor}`,
          contagem: todos.filter((p) => naAba(a.valor, p.status)).length,
        }))}
      />

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdGavel} titulo="Nenhum contrato nesta etapa" descricao="Os contratos aparecem aqui assim que a diretoria aprova o pedido de venda." />
        </div>
      ) : (
        <Table minWidth={1080}>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Validação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => {
              const cliente = p.clientes as unknown as { razao_social: string; nome_fantasia: string | null; logo_path: string | null } | null;
              const nome = cliente?.nome_fantasia || cliente?.razao_social || "—";
              const status = statusPedidoVisual(p.status, p.geracao_contrato_erro);
              const marcados = p.contrato ? (marcadosPorContrato.get(p.contrato.id) ?? 0) : 0;
              const emValidacao = p.status === "em_revisao_juridica";
              return (
                <LinhaClicavel key={p.id} href={`/pedidos/${p.id}`}>
                  <TableCell className="max-w-[280px] whitespace-normal">
                    <div className="flex items-center gap-3">
                      <LogoCliente url={urlLogoCliente(supabase, cliente?.logo_path ?? null)} nome={nome} />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-bold text-purple-text">{nome}</span>
                        <span className="text-xs text-gray3">Pedido Bling {p.bling_pedido_numero ? `nº ${p.bling_pedido_numero}` : "—"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <BadgeLinha />
                      <span className="text-xs text-gray2">
                        {p.perfil === "clube" ? "Clube" : "Agente"} · {buscarPlanoPorKey(p.plano)?.canonical ?? p.plano}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray2">{(p.profiles as unknown as { nome: string } | null)?.nome ?? "—"}</TableCell>
                  <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor_total)}</TableCell>
                  <TableCell className="text-gray2">{p.contrato ? `v${p.contrato.versao} · ${formatarDataCurta(p.contrato.gerado_em)}` : "Em geração"}</TableCell>
                  <TableCell>
                    {emValidacao && p.contrato ? (
                      <BarraProgresso feito={marcados} total={ITENS_VALIDACAO.length} />
                    ) : (
                      <span className="text-xs text-gray3">{p.contrato && !emValidacao && p.status !== "aprovado" ? "Validado" : "—"}</span>
                    )}
                  </TableCell>
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

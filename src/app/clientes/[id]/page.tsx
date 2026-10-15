import Link from "next/link";
import { notFound } from "next/navigation";
import { MdAttachMoney, MdBusiness, MdEdit, MdExpandMore, MdReceipt } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { buscarCliente, urlLogoCliente } from "@/lib/clientes/consultas";
import { listarPedidosDoCliente } from "@/lib/pedidos/consultas";
import { buscarVisaoBlingDoCliente, buscarDetalheContatoBling, classificarSituacaoParcela } from "@/lib/integracoes/bling";
import { calcularSituacaoCliente } from "@/lib/clientes/situacao";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { STATUS_CLIENTE_VISUAL, STATUS_PARCELA_VISUAL, statusPedidoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoVoltar } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";

const ROTULO_PERFIL_CLIENTE = { clube: "Clube", agente: "Agente" } as const;

export default async function ClienteDetalhePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const cliente = await buscarCliente(supabase, id);
  if (!cliente) notFound();

  const pedidosLocais = await listarPedidosDoCliente(supabase, id);
  const visaoBling = await buscarVisaoBlingDoCliente(supabase, cliente.cnpj);
  const classificacoesBling = visaoBling.pedidos.flatMap((p) =>
    p.parcelas.map((parcela) => classificarSituacaoParcela(parcela.situacao, parcela.vencimento)),
  );
  const temParcelaAtrasadaBling = classificacoesBling.includes("atrasada");
  const temParcelaAVencerBling = classificacoesBling.includes("em_aberto");
  const { situacao, contratoVigente } = calcularSituacaoCliente(
    pedidosLocais,
    temParcelaAtrasadaBling,
    temParcelaAVencerBling,
    visaoBling.pedidos.length,
  );
  const statusCliente = STATUS_CLIENTE_VISUAL[situacao];

  // Bling é a base oficial de razão social/nome fantasia/CNPJ/endereço — a
  // cópia local só existe pra preencher o cadastro e eventualmente alimentar
  // a criação de pedido de venda, nunca pra exibição aqui.
  const detalheBling = cliente.bling_contato_id ? await buscarDetalheContatoBling(supabase, cliente.bling_contato_id) : null;
  const razaoSocialExibida = detalheBling?.nome ?? cliente.razao_social;
  const nomeFantasiaExibido = detalheBling?.fantasia ?? cliente.nome_fantasia;
  const cnpjExibido = detalheBling?.cnpj ?? cliente.cnpj;
  const enderecoExibido = formatarEnderecoCliente(detalheBling ?? cliente);

  const avisoParcelas = !visaoBling.conectado
    ? { titulo: "Bling não conectado", descricao: "Conecte em Administração · Configurações para ver o status de pagamento." }
    : !visaoBling.contatoEncontrado
      ? { titulo: "Cliente não encontrado no Bling", descricao: "Nenhum contato com este CNPJ foi encontrado no Bling." }
      : visaoBling.pedidos.length === 0
        ? { titulo: "Nenhum pedido de venda no Bling", descricao: "As parcelas aparecem aqui quando houver pedido de venda deste cliente no Bling." }
        : null;

  return (
    <div className="flex max-w-[1400px] flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <BotaoVoltar href="/clientes" />
        <LogoCliente url={urlLogoCliente(supabase, cliente.logo_path)} nome={razaoSocialExibida} tamanho="lg" />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.01em] text-darkPurple1">{nomeFantasiaExibido || razaoSocialExibida}</h1>
            <StatusPill tom={statusCliente.tom}>{statusCliente.rotulo}</StatusPill>
          </div>
          <span className="text-sm text-gray">
            {ROTULO_PERFIL_CLIENTE[cliente.tipo]} • {formatarCnpj(cnpjExibido)}
            {contratoVigente ? ` • contrato vigente até ${formatarDataCurta(contratoVigente.vigencia_fim)}` : ""}
          </span>
        </div>
        <Button variant="white" nativeButton={false} render={<Link href={`/clientes/${cliente.id}/editar`} />}>
          <MdEdit className="size-4" />
          Editar dados
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo icone={MdReceipt} cor="bg-iconGreen" titulo="Pedidos de venda" extra={<span className="text-sm font-semibold text-gray3">no Footlink</span>}>
            {pedidosLocais.length === 0 ? (
              <EstadoVazio compacto icone={MdReceipt} titulo="Nenhum pedido no sistema" descricao="Os pedidos criados pelo comercial para este cliente aparecem aqui." />
            ) : (
              <Table minWidth={620}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Valor mensal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosLocais.map((p) => {
                    const s = statusPedidoVisual(p.status);
                    return (
                      <LinhaClicavel key={p.id} href={`/pedidos/${p.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BadgeLinha />
                            <span className="text-[13px] text-gray2">{buscarPlanoPorKey(p.plano)?.canonical ?? p.plano}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray2">
                          {formatarDataCurta(p.vigencia_inicio)} a {formatarDataCurta(p.vigencia_fim)}
                        </TableCell>
                        <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor_mensal)}</TableCell>
                        <TableCell>
                          <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
                        </TableCell>
                      </LinhaClicavel>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardModulo>

          <CardModulo icone={MdAttachMoney} cor="bg-iconYellow" titulo="Parcelas" extra={<span className="text-sm font-semibold text-gray3">no Bling</span>}>
            {avisoParcelas ? (
              <EstadoVazio compacto icone={MdAttachMoney} titulo={avisoParcelas.titulo} descricao={avisoParcelas.descricao} />
            ) : (
              <div className="flex flex-col gap-3">
                {visaoBling.pedidos.map((pedido, indice) => {
                  const pagas = pedido.parcelas.filter((p) => classificarSituacaoParcela(p.situacao, p.vencimento) === "recebida").length;
                  return (
                    // Lista já vem ordenada por data desc — o pedido mais recente é a
                    // melhor aproximação do "contrato vigente" (não existe vínculo
                    // explícito entre pedido local e pedido de venda do Bling) e fica
                    // expandido; os demais (contratos encerrados) começam recolhidos.
                    <details key={pedido.id} className="group rounded-lg border border-gray5" open={indice === 0}>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 select-none hover:bg-surface-hover">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-bold text-darkPurple1">Pedido de venda #{pedido.numero}</span>
                          <span className="truncate text-xs text-gray3">{pedido.descricaoItens || "sem descrição"}</span>
                        </span>
                        <BarraProgresso feito={pagas} total={pedido.parcelas.length} largura="w-20" />
                        <span className="w-28 text-right text-sm font-bold text-darkPurple1">{formatarMoeda(pedido.total)}</span>
                        <MdExpandMore className="size-5 text-gray3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-gray5 p-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parcela</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pedido.parcelas.map((parcela, i) => {
                              const s = STATUS_PARCELA_VISUAL[classificarSituacaoParcela(parcela.situacao, parcela.vencimento)];
                              return (
                                <TableRow key={parcela.id}>
                                  <TableCell className="text-gray2">
                                    {i + 1}/{pedido.parcelas.length}
                                  </TableCell>
                                  <TableCell className="text-gray2">{formatarDataCurta(parcela.vencimento)}</TableCell>
                                  <TableCell className="font-semibold text-darkPurple1">{formatarMoeda(parcela.valor)}</TableCell>
                                  <TableCell>
                                    <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardModulo>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo icone={MdBusiness} cor="bg-iconBlue" titulo="Dados do cliente">
            {!detalheBling && (
              <p className="-mt-1 rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
                Sem vínculo com um contato do Bling — mostrando dados locais, que podem estar desatualizados ou incompletos.
              </p>
            )}
            <div className="flex flex-col">
              <LinhaChaveValor rotulo="Razão social" valor={razaoSocialExibida} longo />
              {nomeFantasiaExibido && <LinhaChaveValor rotulo="Nome fantasia" valor={nomeFantasiaExibido} />}
              {cliente.apelido && <LinhaChaveValor rotulo="Apelido" valor={cliente.apelido} />}
              <LinhaChaveValor rotulo="CNPJ" valor={formatarCnpj(cnpjExibido)} />
              <LinhaChaveValor rotulo="Perfil" valor={ROTULO_PERFIL_CLIENTE[cliente.tipo]} />
              <LinhaChaveValor rotulo="Endereço" valor={enderecoExibido} longo />
              <LinhaChaveValor rotulo="Foro preferencial" valor={cliente.foro_preferencial} />
              {contratoVigente && <LinhaChaveValor rotulo="Contrato vigente até" valor={formatarDataCurta(contratoVigente.vigencia_fim)} />}
            </div>
          </CardModulo>
        </div>
      </div>
    </div>
  );
}

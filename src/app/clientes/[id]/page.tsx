import Link from "next/link";
import { notFound } from "next/navigation";
import { MdBusiness, MdChevronRight, MdDescription, MdEdit, MdExpandMore } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { buscarCliente, urlLogoCliente } from "@/lib/clientes/consultas";
import { listarPedidosDoCliente } from "@/lib/pedidos/consultas";
import { buscarVisaoBlingDoCliente, buscarDetalheContatoBling, classificarSituacaoParcela, pedidoBlingCancelado } from "@/lib/integracoes/bling";
import { exigirPapel } from "@/lib/auth/session";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { calcularSituacaoCliente } from "@/lib/clientes/situacao";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { STATUS_CLIENTE_VISUAL, STATUS_CONTRATO_VISUAL, STATUS_PARCELA_VISUAL } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoVoltar } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ds/status-pill";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";

const ROTULO_PERFIL_CLIENTE = { clube: "Clube", agente: "Agente" } as const;

/** "2 anos e 3 meses" entre duas datas aaaa-mm-dd (meses completos). */
function tempoDeRelacionamento(desde: string, ate: string) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  const meses = Math.max(0, (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (meses === 0) return "Menos de 1 mês";
  const partes = [anos && `${anos} ${anos === 1 ? "ano" : "anos"}`, resto && `${resto} ${resto === 1 ? "mês" : "meses"}`].filter(Boolean);
  return partes.join(" e ");
}

export default async function ClienteDetalhePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const sessao = await exigirPapel("vendedor", "admin");
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
  // Bling é a base oficial de razão social/nome fantasia/CNPJ/endereço — a
  // cópia local só existe pra preencher o cadastro e eventualmente alimentar
  // a criação de pedido de venda, nunca pra exibição aqui.
  const detalheBling = cliente.bling_contato_id ? await buscarDetalheContatoBling(supabase, cliente.bling_contato_id) : null;
  const razaoSocialExibida = detalheBling?.nome ?? cliente.razao_social;
  const nomeFantasiaExibido = detalheBling?.fantasia ?? cliente.nome_fantasia;
  const cnpjExibido = detalheBling?.cnpj ?? cliente.cnpj;
  const enderecoExibido = formatarEnderecoCliente(detalheBling ?? cliente);

  // Situação de cada pedido de venda vem do cache da sincronização (a visão ao
  // vivo não traz) — pedidos cancelados no Bling ficam fora dos totalizadores.
  const { data: situacoesCache } = visaoBling.pedidos.length
    ? await supabase.from("bling_pedidos").select("id, situacao_id, situacao_valor").in("id", visaoBling.pedidos.map((p) => p.id))
    : { data: [] };
  const canceladoPorId = new Map((situacoesCache ?? []).map((p) => [p.id, pedidoBlingCancelado(p.situacao_id, p.situacao_valor)]));
  const contratosValidos = visaoBling.pedidos.filter((p) => !canceladoPorId.get(p.id));
  const totalContratado = contratosValidos.reduce((s, p) => s + Number(p.total), 0);
  const cancelados = visaoBling.pedidos.length - contratosValidos.length;
  // Recebido / a receber: parcelas dos contratos não cancelados. Paga só em
  // parte conta como "a receber" (ainda tem saldo), como em Financeiro · Contratos.
  const parcelasValidas = contratosValidos.flatMap((p) => p.parcelas.map((x) => ({ ...x, situacao: classificarSituacaoParcela(x.situacao, x.vencimento) })));
  const somaParcelas = (lista: typeof parcelasValidas) => lista.reduce((s, x) => s + Number(x.valor), 0);
  const totalRecebido = somaParcelas(parcelasValidas.filter((x) => x.situacao === "recebida"));
  const totalAReceber = somaParcelas(parcelasValidas.filter((x) => x.situacao !== "recebida"));
  const totalVencido = somaParcelas(parcelasValidas.filter((x) => x.situacao === "atrasada"));
  const primeiraVenda = contratosValidos.reduce<string | null>((min, p) => (p.data && (!min || p.data < min) ? p.data : min), null);
  // Detalhe do contrato fica no Financeiro, que é só da Diretoria.
  const podeAbrirContrato = sessao.papel === "admin";

  // Vigência dos contratos do Bling é controlada na plataforma (0034).
  const hoje = hojeLocal();
  const { data: vigenciasBling } = contratosValidos.length
    ? await supabase.from("contrato_vigencia_bling").select("bling_pedido_id, vigencia_fim").in("bling_pedido_id", contratosValidos.map((p) => p.id))
    : { data: [] };
  const fimVigenciaBling = (vigenciasBling ?? []).reduce<string | null>((max, v) => (v.vigencia_fim >= hoje && (!max || v.vigencia_fim > max) ? v.vigencia_fim : max), null);

  const { situacao, contratoVigente } = calcularSituacaoCliente(
    pedidosLocais,
    temParcelaAtrasadaBling,
    temParcelaAVencerBling,
    visaoBling.pedidos.length,
    !!fimVigenciaBling,
  );
  const statusCliente = STATUS_CLIENTE_VISUAL[situacao];
  const fimContratoVigente = [contratoVigente?.vigencia_fim, fimVigenciaBling].filter((d): d is string => !!d).sort().pop() ?? null;

  const avisoParcelas = !visaoBling.conectado
    ? { titulo: "Bling não conectado", descricao: "Conecte em Administração · Configurações para ver o status de pagamento." }
    : !visaoBling.contatoEncontrado
      ? { titulo: "Cliente não encontrado no Bling", descricao: "Nenhum contato com este CNPJ foi encontrado no Bling." }
      : visaoBling.pedidos.length === 0
        ? { titulo: "Nenhum contrato no Bling", descricao: "Os contratos aparecem aqui quando houver pedido de venda deste cliente no Bling." }
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
            {fimContratoVigente ? ` • contrato vigente até ${formatarDataCurta(fimContratoVigente)}` : ""}
          </span>
        </div>
        <Button variant="white" nativeButton={false} render={<Link href={`/clientes/${cliente.id}/editar`} />}>
          <MdEdit className="size-4" />
          Editar dados
        </Button>
      </div>

      {visaoBling.conectado && visaoBling.contatoEncontrado && (
        <GradeKpis>
          <KpiCard
            rotulo="Total contratado"
            valor={formatarMoedaCompacta(totalContratado)}
            apoio={
              contratosValidos.length
                ? `soma ${contratosValidos.length === 1 ? "do contrato" : `dos ${contratosValidos.length} contratos`}${cancelados ? ` · ${cancelados} ${cancelados === 1 ? "cancelado fora" : "cancelados fora"}` : ""}`
                : "nenhum contrato no Bling"
            }
          />
          <KpiCard
            rotulo="Total recebido"
            valor={formatarMoedaCompacta(totalRecebido)}
            corValor="text-green1"
            destaque={totalContratado > 0 ? `${Math.round((totalRecebido / totalContratado) * 100)}%` : undefined}
            tomDestaque="positivo"
            apoio="parcelas pagas"
          />
          <KpiCard
            rotulo="Total a receber"
            valor={formatarMoedaCompacta(totalAReceber)}
            destaque={totalVencido > 0 ? `${formatarMoedaCompacta(totalVencido)} vencido` : undefined}
            tomDestaque="negativo"
            apoio={totalVencido > 0 ? "em atraso" : "em aberto, nada vencido"}
          />
          <KpiCard
            rotulo="Cliente Footure há"
            valor={primeiraVenda ? tempoDeRelacionamento(primeiraVenda, hoje) : "—"}
            apoio={primeiraVenda ? `desde ${formatarDataCurta(primeiraVenda)} (primeira venda)` : "sem vendas no Bling"}
          />
        </GradeKpis>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo icone={MdDescription} cor="bg-iconYellow" titulo="Contratos" extra={<span className="text-sm font-semibold text-gray3">no Bling</span>}>
            {avisoParcelas ? (
              <EstadoVazio compacto icone={MdDescription} titulo={avisoParcelas.titulo} descricao={avisoParcelas.descricao} />
            ) : (
              <div className="flex flex-col gap-3">
                {visaoBling.pedidos.map((pedido, indice) => {
                  const pagas = pedido.parcelas.filter((p) => classificarSituacaoParcela(p.situacao, p.vencimento) === "recebida").length;
                  const cancelado = !!canceladoPorId.get(pedido.id);
                  return (
                    // Lista já vem ordenada por data desc — o pedido mais recente é a
                    // melhor aproximação do "contrato vigente" (não existe vínculo
                    // explícito entre pedido local e pedido de venda do Bling) e fica
                    // expandido; os demais (contratos encerrados) começam recolhidos.
                    <details key={pedido.id} className="group rounded-lg border border-gray5" open={indice === 0}>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 select-none hover:bg-surface-hover">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-darkPurple1">
                            Pedido de venda #{pedido.numero}
                            {cancelado && <StatusPill tom={STATUS_CONTRATO_VISUAL.cancelado.tom}>{STATUS_CONTRATO_VISUAL.cancelado.rotulo}</StatusPill>}
                          </span>
                          <span className="truncate text-xs text-gray3">{pedido.descricaoItens || "sem descrição"}</span>
                        </span>
                        <BarraProgresso feito={pagas} total={pedido.parcelas.length} largura="w-20" />
                        <span className="w-28 text-right text-sm font-bold text-darkPurple1">{formatarMoeda(pedido.total)}</span>
                        <MdExpandMore className="size-5 text-gray3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="flex flex-col gap-3 border-t border-gray5 p-3">
                        {podeAbrirContrato && (
                          <Link
                            href={`/financeiro/contratos/${pedido.id}`}
                            className="flex items-center gap-1 self-end text-sm font-semibold text-purple-text hover:underline"
                          >
                            Ver contrato
                            <MdChevronRight className="size-4" />
                          </Link>
                        )}
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
              <LinhaChaveValor
                rotulo="ID no Footlink"
                valor={cliente.footlink_org_id ? <span className="font-mono">{cliente.footlink_org_id}</span> : <span className="text-gray3">sem conta vinculada</span>}
              />
              <LinhaChaveValor rotulo="CNPJ" valor={formatarCnpj(cnpjExibido)} />
              <LinhaChaveValor rotulo="Perfil" valor={ROTULO_PERFIL_CLIENTE[cliente.tipo]} />
              <LinhaChaveValor rotulo="Endereço" valor={enderecoExibido} longo />
              <LinhaChaveValor rotulo="Foro preferencial" valor={cliente.foro_preferencial} />
              {fimContratoVigente && <LinhaChaveValor rotulo="Contrato vigente até" valor={formatarDataCurta(fimContratoVigente)} />}
            </div>
          </CardModulo>
        </div>
      </div>
    </div>
  );
}

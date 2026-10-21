import { notFound } from "next/navigation";
import Link from "next/link";
import { MdAttachMoney, MdBusiness, MdEdit, MdDescription, MdDownload, MdGavel, MdHistory, MdInfo, MdOpenInNew, MdReceipt } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { carregarContrato, type ParcelaCarteira } from "@/lib/financeiro/carteira";
import { buscarDetalheContatoBling, buscarPedidoVendaBling } from "@/lib/integracoes/bling";
import { buscarPedidoDetalhe, listarUsuariosParaAtribuicaoVenda } from "@/lib/pedidos/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { nomeArquivoContrato } from "@/lib/contratos/nomeArquivo";
import { STATUS_CONTRATO_VISUAL, STATUS_PARCELA_VISUAL, statusPedidoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta, rotuloPagamento } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoVoltar } from "@/components/shell/page-header";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { TimelineTransicoes, tituloTransicao, type EventoTimeline } from "@/components/pedido/timeline-transicoes";
import { IndicadorBling } from "@/components/financeiro/tela-contratos";
import { AnexarContratoBling } from "@/components/financeiro/anexar-contrato-bling";
import { ROTULO_ORIGEM_VENDA, ROTULO_TIPO_VENDA } from "@/lib/vendas/rotulos";

const ROTULO_PERFIL_CLIENTE = { clube: "Clube", agente: "Agente" } as const;

function formatarTamanho(bytes: number | null) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** Eventos financeiros de cada parcela: baixa (com a data do borderô), pagamento parcial e vencimento sem pagamento. */
function eventosDaParcela(p: ParcelaCarteira): EventoTimeline[] {
  const rotulo = `parcela ${p.numero}/${p.totalDoPedido}`;
  if (p.situacao === "recebida") {
    const atraso = p.dataPagamento ? diasEntre(p.vencimento, p.dataPagamento) : 0;
    return [
      {
        id: `baixa-${p.id}`,
        data: p.dataPagamento ?? p.vencimento,
        soData: true,
        titulo: `Baixa da ${rotulo}`,
        comentario: p.dataPagamento
          ? `${formatarMoeda(p.valorPago ?? p.valor)} pago${atraso > 0 ? ` · ${atraso} ${atraso === 1 ? "dia" : "dias"} após o vencimento` : ""}.`
          : `${formatarMoeda(p.valor)} pago — data da baixa ainda não importada do Bling (data exibida = vencimento).`,
      },
    ];
  }
  if (p.situacao === "recebida_parcial") {
    return [
      {
        id: `parcial-${p.id}`,
        data: p.dataPagamento ?? p.vencimento,
        soData: true,
        titulo: `Pagamento parcial da ${rotulo}`,
        comentario: `${p.valorPago !== null ? formatarMoeda(p.valorPago) : "Valor"} de ${formatarMoeda(p.valor)} pago.`,
      },
    ];
  }
  if (p.situacao === "atrasada") {
    return [{ id: `vencida-${p.id}`, data: p.vencimento, soData: true, titulo: `Parcela ${p.numero}/${p.totalDoPedido} venceu sem pagamento`, comentario: `${formatarMoeda(p.valor)} em aberto.` }];
  }
  return [];
}

// Detalhe de um contrato do Financeiro (= pedido de venda do Bling, pelo id do
// Bling): dados do pedido, cliente, documento do contrato, parcelas e linha do
// tempo. Quando o pedido nasceu na plataforma (pedidos.bling_pedido_id), mostra
// os dados e as versões do contrato de lá; senão, o detalhe do Bling (ao vivo,
// com observações internas) e o anexo manual do contrato (0033).
export default async function ContratoFinanceiroPage({ params }: PageProps<"/financeiro/contratos/[id]">) {
  const { id } = await params;
  const blingPedidoId = Number(id);
  if (!Number.isSafeInteger(blingPedidoId)) notFound();

  // Vendedor consulta; editar dados e anexar arquivos é só da Diretoria.
  const sessao = await exigirPapel("admin", "vendedor");
  const ehAdmin = sessao.papel === "admin";
  const supabase = await createClient();
  const dados = await carregarContrato(supabase, blingPedidoId);
  if (!dados) notFound();
  const { pedido, contrato, parcelas, clienteLocal, contato, arquivos, resumo, vigencia } = dados;

  const { data: vinculo } = await supabase.from("pedidos").select("id").eq("bling_pedido_id", String(blingPedidoId)).maybeSingle();
  const [detalheLocal, detalheBling, contatoBling, { data: equipe }, usuariosComercial, { data: licencas }] = await Promise.all([
    vinculo ? buscarPedidoDetalhe(supabase, vinculo.id) : Promise.resolve(null),
    buscarPedidoVendaBling(supabase, blingPedidoId),
    clienteLocal ? Promise.resolve(null) : buscarDetalheContatoBling(supabase, pedido.contato_id),
    supabase.from("contrato_equipe_bling").select("sdr_id, closer_id, tipo_venda, origem, atualizado_por, atualizado_em").eq("bling_pedido_id", blingPedidoId).maybeSingle(),
    listarUsuariosParaAtribuicaoVenda(supabase),
    supabase
      .from("contrato_licencas_bling")
      .select("licencas_pagas, licencas_gratuitas, valor_licenca_adicional, atualizado_por, atualizado_em")
      .eq("bling_pedido_id", blingPedidoId)
      .maybeSingle(),
  ]);
  const valorAdicional = licencas?.valor_licenca_adicional === null || licencas?.valor_licenca_adicional === undefined ? null : Number(licencas.valor_licenca_adicional);
  const resumoLicencas = licencas
    ? `${licencas.licencas_pagas} ${licencas.licencas_pagas === 1 ? "paga" : "pagas"}${licencas.licencas_gratuitas > 0 ? ` + ${licencas.licencas_gratuitas} ${licencas.licencas_gratuitas === 1 ? "gratuita" : "gratuitas"}` : ""}`
    : null;
  // SDR e Closer de venda do Bling (0035) — nomes pela lista do comercial.
  const nomeUsuario = (id: string | null | undefined) => (id ? (usuariosComercial.find((u) => u.user_id === id)?.nome ?? null) : null);
  const sdrNome = nomeUsuario(equipe?.sdr_id);
  const closerNome = nomeUsuario(equipe?.closer_id);
  const pedidoLocal = detalheLocal?.pedido ?? null;
  const faltando = [
    !contrato.vigenciaDefinida && "a vigência",
    !equipe?.tipo_venda && !equipe?.origem && "o tipo de venda e a origem",
    !sdrNome && !closerNome && "SDR e Closer",
    !licencas && "as licenças",
  ].filter((x): x is string => !!x);

  const situacao = STATUS_CONTRATO_VISUAL[contrato.situacao];
  const nomeCliente = contrato.cliente;
  const hrefCliente = clienteLocal ? `/clientes/${clienteLocal.id}` : `/clientes/bling/${pedido.contato_id}`;

  // Documento: versões geradas na plataforma (com PDF assinado, se houver) ou arquivos anexados aqui.
  const versoes = await Promise.all(
    (detalheLocal?.contratos ?? []).map(async (c) => {
      const nomeDownload = nomeArquivoContrato(clienteLocal?.razao_social ?? nomeCliente, c.gerado_em, c.versao);
      const caminho = c.arquivo_assinado_path ?? c.arquivo_path;
      const { data } = await supabase.storage
        .from("contratos")
        .createSignedUrl(caminho, 3600, { download: c.arquivo_assinado_path ? nomeDownload.replace(/\.docx$/, ".pdf") : nomeDownload });
      return { ...c, url: data?.signedUrl ?? null, assinado: !!c.arquivo_assinado_path };
    }),
  );
  const anexos = await Promise.all(
    arquivos.map(async (a) => {
      const { data } = await supabase.storage.from("contratos").createSignedUrl(a.arquivo_path, 3600, { download: a.nome_arquivo });
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );

  const chaveOrdem = (e: EventoTimeline) => (e.soData ? `${e.data}T23:59:59` : e.data);
  const eventos = ([
    ...(pedido.data
      ? [{ id: "bling-criado", data: pedido.data, soData: true, titulo: `Pedido de venda nº ${pedido.numero} lançado no Bling`, comentario: `${formatarMoeda(contrato.valorTotal)} em ${parcelas.length} ${parcelas.length === 1 ? "parcela" : "parcelas"}.` }]
      : []),
    ...(pedidoLocal
      ? [
          { id: "local-criado", data: pedidoLocal.criado_em, nome: (pedidoLocal.profiles as unknown as { nome: string } | null)?.nome ?? null, titulo: "Pedido criado na plataforma" },
          ...(detalheLocal?.transicoes ?? []).map((t) => ({
            id: t.id,
            data: t.criado_em,
            nome: (t.profiles as unknown as { nome: string } | null)?.nome ?? null,
            titulo: tituloTransicao(t),
            comentario: t.comentario,
          })),
          ...versoes.map((c) => ({ id: `versao-${c.id}`, data: c.gerado_em, titulo: `Contrato v${c.versao} gerado`, comentario: c.motivo_versao })),
        ]
      : []),
    ...(vigencia && contrato.inicio && contrato.fim
      ? [
          {
            id: "vigencia",
            data: vigencia.atualizadoEm,
            nome: vigencia.atualizadoPor,
            titulo: "Vigência do contrato definida",
            comentario: `${formatarDataCurta(contrato.inicio)} a ${formatarDataCurta(contrato.fim)}.`,
          },
        ]
      : []),
    ...(equipe && (sdrNome || closerNome || equipe.tipo_venda || equipe.origem)
      ? [
          {
            id: "equipe",
            data: equipe.atualizado_em,
            nome: nomeUsuario(equipe.atualizado_por),
            titulo: "Dados comerciais definidos",
            comentario: [
              equipe.tipo_venda && ROTULO_TIPO_VENDA[equipe.tipo_venda],
              equipe.origem && `origem ${ROTULO_ORIGEM_VENDA[equipe.origem].toLowerCase()}`,
              `SDR: ${sdrNome ?? "não informado"}`,
              `Closer: ${closerNome ?? "não informado"}`,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []),
    ...(licencas
      ? [
          {
            id: "licencas",
            data: licencas.atualizado_em,
            nome: nomeUsuario(licencas.atualizado_por),
            titulo: "Licenças definidas",
            comentario: `${resumoLicencas}${valorAdicional !== null ? ` · licença adicional ${formatarMoeda(valorAdicional)}` : ""}.`,
          },
        ]
      : []),
    ...anexos.map((a) => ({ id: `anexo-${a.id}`, data: a.enviado_em, nome: a.enviadoPor, titulo: "Contrato anexado", comentario: a.nome_arquivo })),
    ...parcelas.flatMap(eventosDaParcela),
  ] as EventoTimeline[]).sort((a, b) => chaveOrdem(b).localeCompare(chaveOrdem(a)));

  const pctPago = contrato.valorTotal > 0 ? Math.round((resumo.pago / contrato.valorTotal) * 100) : 0;
  const cnpj = clienteLocal?.cnpj ?? contatoBling?.cnpj ?? contato?.cnpj ?? null;
  const endereco = clienteLocal ? formatarEnderecoCliente(clienteLocal) : contatoBling ? formatarEnderecoCliente(contatoBling) : null;

  return (
    <div className="flex max-w-[1400px] flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <BotaoVoltar href="/financeiro" />
        <LogoCliente url={urlLogoCliente(supabase, contrato.logoPath)} nome={nomeCliente} tamanho="lg" />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.01em] text-darkPurple1">{nomeCliente}</h1>
            <BadgeLinha />
            <StatusPill tom={situacao.tom}>{situacao.rotulo}</StatusPill>
          </div>
          <span className="text-sm text-gray">
            Pedido Bling nº {pedido.numero} • {formatarMoeda(contrato.valorTotal)} • {contrato.inicio ? formatarDataCurta(contrato.inicio) : "—"} a{" "}
            {contrato.fim ? formatarDataCurta(contrato.fim) : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IndicadorBling sincronizadoEm={dados.sincronizadoEm} />
          {ehAdmin && !pedidoLocal && (
            <Button variant="white" nativeButton={false} render={<Link href={`/financeiro/contratos/${blingPedidoId}/editar`} />}>
              <MdEdit className="size-4" />
              Editar dados do contrato
            </Button>
          )}
        </div>
      </div>

      <GradeKpis>
        <KpiCard
          rotulo="Valor do contrato"
          valor={formatarMoedaCompacta(contrato.valorTotal)}
          destaque={`${contrato.totalParcelas} ${contrato.totalParcelas === 1 ? "parcela" : "parcelas"}`}
          apoio="no Bling"
        />
        <KpiCard
          rotulo="Pago"
          valor={formatarMoedaCompacta(resumo.pago)}
          corValor="text-green1"
          destaque={`${pctPago}%`}
          tomDestaque="positivo"
          apoio={`${contrato.pagas} de ${contrato.totalParcelas} parcelas`}
        />
        <KpiCard
          rotulo="A vencer"
          valor={formatarMoedaCompacta(resumo.emAberto)}
          apoio={contrato.proximoVencimento ? `próximo em ${formatarDataCurta(contrato.proximoVencimento)}` : "nenhuma parcela a vencer"}
        />
        <KpiCard rotulo="Vencido" valor={formatarMoedaCompacta(resumo.vencido)} corValor={resumo.vencido > 0 ? "text-red" : undefined} apoio="parcelas atrasadas" />
      </GradeKpis>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Pedido de venda */}
          {pedidoLocal ? (
            <CardModulo
              icone={MdReceipt}
              cor="bg-iconGreen"
              titulo="Pedido de venda"
              extra={
                <Link href={`/pedidos/${pedidoLocal.id}`} className="flex items-center gap-1 text-sm font-semibold text-purple-text hover:underline">
                  Ver pedido na plataforma
                  <MdOpenInNew className="size-4" />
                </Link>
              }
            >
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <LinhaChaveValor rotulo="Número (Bling)" valor={pedido.numero} />
                <LinhaChaveValor rotulo="Status" valor={<StatusPill tom={statusPedidoVisual(pedidoLocal.status).tom}>{statusPedidoVisual(pedidoLocal.status).rotulo}</StatusPill>} />
                <LinhaChaveValor rotulo="Plano" valor={`${pedidoLocal.produtos.includes("api") ? "Footlink + API" : "Footlink"} · ${buscarPlanoPorKey(pedidoLocal.plano)?.canonical ?? pedidoLocal.plano}`} />
                <LinhaChaveValor rotulo="Pagamento" valor={rotuloPagamento(pedidoLocal.forma_pagamento, pedidoLocal.meio_pagamento, pedidoLocal.numero_parcelas)} />
                <LinhaChaveValor rotulo="Valor total" valor={formatarMoeda(pedidoLocal.valor_total)} />
                <LinhaChaveValor rotulo="Vigência" valor={`${formatarDataCurta(pedidoLocal.vigencia_inicio)} a ${formatarDataCurta(pedidoLocal.vigencia_fim)}`} />
                {pedidoLocal.condicao_especial && <LinhaChaveValor rotulo="Condição especial" valor={pedidoLocal.condicao_especial} longo className="md:col-span-2" />}
                {detalheBling?.observacoesInternas && (
                  <LinhaChaveValor
                    rotulo="Observações internas (Bling)"
                    valor={<span className="whitespace-pre-line">{detalheBling.observacoesInternas}</span>}
                    longo
                    className="md:col-span-2"
                  />
                )}
              </div>
            </CardModulo>
          ) : (
            <CardModulo icone={MdReceipt} cor="bg-iconGreen" titulo="Pedido de venda" extra={<span className="text-sm font-semibold text-gray3">no Bling</span>}>
              <p className="-mt-1 flex items-start gap-2 rounded-lg bg-lightPurple4 px-3 py-2 text-xs text-darkPurple1">
                <MdInfo className="mt-px size-4 shrink-0 text-purple-text" />
                Pedido lançado direto no Bling, fora da plataforma — os dados abaixo vêm do Bling.
              </p>
              {!detalheBling && (
                <p className="rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
                  Não foi possível consultar o Bling agora. Itens e observações aparecem quando a conexão voltar; abaixo, os dados da última sincronização.
                </p>
              )}
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <LinhaChaveValor rotulo="Número" valor={pedido.numero} />
                <LinhaChaveValor rotulo="Data da venda" valor={pedido.data ? formatarDataCurta(pedido.data) : null} />
                <LinhaChaveValor
                  rotulo="Vigência"
                  valor={
                    contrato.inicio && contrato.fim ? (
                      <span>
                        {formatarDataCurta(contrato.inicio)} a {formatarDataCurta(contrato.fim)}
                        {!contrato.vigenciaDefinida && <span className="ml-1.5 text-xs font-normal text-gray3">(estimada)</span>}
                      </span>
                    ) : null
                  }
                />
                <LinhaChaveValor
                  rotulo="Tipo de venda"
                  valor={equipe?.tipo_venda ? ROTULO_TIPO_VENDA[equipe.tipo_venda] : <span className="text-gray3">não informado</span>}
                />
                <LinhaChaveValor rotulo="Origem" valor={equipe?.origem ? ROTULO_ORIGEM_VENDA[equipe.origem] : <span className="text-gray3">não informada</span>} />
                <LinhaChaveValor rotulo="SDR" valor={sdrNome ?? <span className="text-gray3">não informado</span>} />
                <LinhaChaveValor rotulo="Closer" valor={closerNome ?? <span className="text-gray3">não informado</span>} />
                <LinhaChaveValor rotulo="Licenças" valor={resumoLicencas ?? <span className="text-gray3">não informadas</span>} />
                <LinhaChaveValor rotulo="Licença adicional" valor={valorAdicional !== null ? formatarMoeda(valorAdicional) : <span className="text-gray3">não informado</span>} />
                {detalheBling?.numeroPedidoCompra && <LinhaChaveValor rotulo="Pedido de compra" valor={detalheBling.numeroPedidoCompra} />}
                {!!detalheBling?.desconto && <LinhaChaveValor rotulo="Desconto" valor={formatarMoeda(detalheBling.desconto)} />}
                <LinhaChaveValor rotulo="Valor total" valor={formatarMoeda(detalheBling?.total || contrato.valorTotal)} />
              </div>
              {faltando.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-orange3 px-3 py-2.5 text-xs font-semibold text-[#ce9232]">
                  <span className="min-w-0 flex-1">
                    Falta informar {faltando.join(", ").replace(/, ([^,]*)$/, " e $1")} — dados que o Bling não tem.
                    {!contrato.vigenciaDefinida && " Sem a vigência, a situação segue as parcelas (contrato pago à vista aparece como concluído)."}
                  </span>
                  {ehAdmin && (
                    <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/financeiro/contratos/${blingPedidoId}/editar`} />}>
                      <MdEdit className="size-4" />
                      Completar dados
                    </Button>
                  )}
                </div>
              )}
              {detalheBling && detalheBling.itens.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Itens</span>
                  {detalheBling.itens.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 border-b border-gray5 py-2 text-sm last:border-0">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold text-darkPurple1">{item.descricao}</span>
                        {item.codigo && <span className="text-xs text-gray3">{item.codigo}</span>}
                      </span>
                      <span className="shrink-0 text-right text-gray2">
                        {item.quantidade.toLocaleString("pt-BR")} × {formatarMoeda(item.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detalheBling && (
                <div className="flex flex-col">
                  <LinhaChaveValor
                    rotulo="Observações"
                    valor={detalheBling.observacoes ? <span className="whitespace-pre-line">{detalheBling.observacoes}</span> : <span className="text-gray3">—</span>}
                    longo
                  />
                  <LinhaChaveValor
                    rotulo="Observações internas"
                    valor={detalheBling.observacoesInternas ? <span className="whitespace-pre-line">{detalheBling.observacoesInternas}</span> : <span className="text-gray3">—</span>}
                    longo
                  />
                </div>
              )}
            </CardModulo>
          )}

          {/* Contrato */}
          <CardModulo
            icone={MdGavel}
            cor="bg-iconPurple"
            titulo="Contrato"
            extra={
              pedidoLocal ? (
                versoes[0] ? <span className="text-sm font-semibold text-gray3">v{versoes[0].versao}</span> : undefined
              ) : ehAdmin && anexos.length > 0 ? (
                <AnexarContratoBling blingPedidoId={blingPedidoId} rotulo="Anexar outro arquivo" />
              ) : undefined
            }
          >
            {pedidoLocal ? (
              versoes.length === 0 ? (
                <EstadoVazio compacto icone={MdGavel} titulo="Contrato ainda não gerado" descricao="O contrato deste pedido é gerado na plataforma — acompanhe pelo pedido." />
              ) : (
                <div className="flex flex-col gap-2">
                  {versoes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border-b border-gray5 pb-2 last:border-0 last:pb-0">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold text-darkPurple1">
                          Versão {c.versao} · {formatarDataCurta(c.gerado_em)}
                        </span>
                        {c.motivo_versao && <span className="truncate text-xs text-gray3">{c.motivo_versao}</span>}
                      </div>
                      {c.url && (
                        <Button variant={c.assinado ? "secondary" : "white"} size="sm" nativeButton={false} render={<a href={c.url} target="_blank" rel="noreferrer" />}>
                          <MdDownload className="size-4" />
                          {c.assinado ? "PDF assinado" : "Baixar"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : anexos.length === 0 ? (
              <EstadoVazio
                compacto
                icone={MdDescription}
                titulo="Contrato gerado fora da plataforma"
                descricao={
                  ehAdmin
                    ? "Anexe o contrato deste pedido (PDF assinado ou .docx, até 20 MB) para deixá-lo junto dos dados financeiros."
                    : "O arquivo do contrato fica disponível para a Diretoria."
                }
                acao={ehAdmin ? <AnexarContratoBling blingPedidoId={blingPedidoId} /> : undefined}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {anexos.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 border-b border-gray5 pb-2 last:border-0 last:pb-0">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-darkPurple1">{a.nome_arquivo}</span>
                      <span className="text-xs text-gray3">
                        {[`Anexado em ${formatarDataCurta(a.enviado_em)}`, a.enviadoPor && `por ${a.enviadoPor}`, formatarTamanho(a.tamanho_bytes)].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {a.url && (
                      <Button variant="white" size="sm" nativeButton={false} render={<a href={a.url} target="_blank" rel="noreferrer" />}>
                        <MdDownload className="size-4" />
                        Baixar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardModulo>

          {/* Parcelas */}
          <CardModulo icone={MdAttachMoney} cor="bg-iconYellow" titulo="Parcelas" extra={<span className="text-sm font-semibold text-gray3">no Bling</span>}>
            {parcelas.length === 0 ? (
              <EstadoVazio compacto icone={MdAttachMoney} titulo="Nenhuma parcela no Bling" descricao="Este pedido de venda ainda não tem contas a receber lançadas no Bling." />
            ) : (
              <Table minWidth={680}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Valor pago</TableHead>
                    <TableHead>Data da baixa</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.map((p) => {
                    const s = STATUS_PARCELA_VISUAL[p.situacao];
                    const paga = p.situacao === "recebida" || p.situacao === "recebida_parcial";
                    const valorPago = p.situacao === "recebida" ? (p.valorPago ?? p.valor) : p.situacao === "recebida_parcial" ? p.valorPago : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-darkPurple1">
                          {p.numero}/{p.totalDoPedido}
                        </TableCell>
                        <TableCell className="text-gray2">{formatarDataCurta(p.vencimento)}</TableCell>
                        <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor)}</TableCell>
                        <TableCell className={valorPago !== null ? "font-semibold text-green1" : "text-gray3"}>{valorPago !== null ? formatarMoeda(valorPago) : "—"}</TableCell>
                        <TableCell>
                          {paga ? (
                            p.dataPagamento ? (
                              <span
                                className={p.dataPagamento > p.vencimento ? "font-semibold text-[#ce9232]" : "text-gray2"}
                                title={p.dataPagamento > p.vencimento ? "Paga depois do vencimento" : undefined}
                              >
                                {formatarDataCurta(p.dataPagamento)}
                              </span>
                            ) : (
                              <span className="text-gray3" title="A data de baixa chega na próxima sincronização com o Bling">
                                aguardando
                              </span>
                            )
                          ) : (
                            <span className="text-gray3">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardModulo>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo
            icone={MdBusiness}
            cor="bg-iconBlue"
            titulo="Cliente"
            extra={
              <Link href={hrefCliente} className="text-sm font-semibold text-purple-text hover:underline">
                Ver perfil completo
              </Link>
            }
          >
            {!clienteLocal && (
              <p className="-mt-1 rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">Contato do Bling ainda sem cadastro na plataforma.</p>
            )}
            <div className="flex flex-col">
              <LinhaChaveValor rotulo="Razão social" valor={clienteLocal?.razao_social ?? contatoBling?.nome ?? contato?.nome} longo />
              {(clienteLocal?.nome_fantasia ?? contatoBling?.fantasia) && <LinhaChaveValor rotulo="Nome fantasia" valor={clienteLocal?.nome_fantasia ?? contatoBling?.fantasia} />}
              <LinhaChaveValor rotulo="CNPJ" valor={cnpj ? formatarCnpj(cnpj) : null} />
              {clienteLocal && <LinhaChaveValor rotulo="Perfil" valor={ROTULO_PERFIL_CLIENTE[clienteLocal.tipo]} />}
              <LinhaChaveValor rotulo="Endereço" valor={endereco} longo />
            </div>
          </CardModulo>

          <CardModulo icone={MdHistory} cor="bg-iconGray" titulo="Linha do tempo">
            <TimelineTransicoes eventos={eventos} />
          </CardModulo>
        </div>
      </div>
    </div>
  );
}

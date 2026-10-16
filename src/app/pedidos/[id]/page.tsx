import { notFound } from "next/navigation";
import Link from "next/link";
import { MdAttachMoney, MdBlock, MdBusiness, MdDownload, MdEdit, MdGavel, MdHistory, MdInfo, MdReceipt, MdWarning } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { buscarPedidoDetalhe } from "@/lib/pedidos/consultas";
import { pedidoEhEditavel } from "@/lib/pedidos/statusEditavel";
import { acaoPendente } from "@/lib/pedidos/acaoPendente";
import { montarEtapasNegocio } from "@/lib/pedidos/etapasNegocio";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { gerarAlertas } from "@/lib/validacoes/pedido";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { nomeArquivoContrato } from "@/lib/contratos/nomeArquivo";
import { statusPedidoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda, rotuloPagamento } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/shell/page-header";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { Stepper } from "@/components/ds/stepper";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { ListaSignatarios } from "@/components/negocio/lista-signatarios";
import { carregarSignatariosExibidos } from "@/lib/contratos/signatariosExibidos";
import { PainelAlertas } from "@/components/pedido/painel-alertas";
import { AcoesPedido } from "@/components/pedido/acoes-pedido";
import { CancelarPedidoDialog } from "@/components/pedido/cancelar-pedido-dialog";
import { TimelineTransicoes, type EventoTimeline } from "@/components/pedido/timeline-transicoes";
import { ROTULO_STATUS } from "@/components/rotulo-status";
import { ROTULO_ORIGEM_VENDA, ROTULO_TIPO_VENDA } from "@/lib/vendas/rotulos";

const VOLTAR_POR_PAPEL = { vendedor: "/vendedor", admin: "/admin", juridico: "/juridico" } as const;
const ROTULO_PERFIL_CLIENTE = { clube: "Clube", agente: "Agente" } as const;
const MODELO_CONTRATO = { clube: "Footlink Clube", agente: "Footlink Agente" } as const;

// Tela "Negócio" do handoff: visão ponta a ponta de um pedido — cabeçalho
// com a ação da próxima etapa, stepper do fluxo e os cards de cliente,
// pedido, contrato (com status por signatário na Clicksign) e parcelas.
export default async function NegocioPage({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const sessao = await exigirPapel("vendedor", "juridico", "admin");
  const supabase = await createClient();

  const detalhe = await buscarPedidoDetalhe(supabase, id);
  if (!detalhe) notFound();
  const { pedido, transicoes, contratos, signatarios } = detalhe;

  const cliente = pedido.clientes as unknown as {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    uf: string | null;
    endereco_legado: string | null;
    tipo: "clube" | "agente";
    logo_path: string | null;
  } | null;
  const nomeCliente = cliente?.nome_fantasia || cliente?.razao_social || "Pedido";
  const vendedorNome = (pedido.profiles as unknown as { nome: string } | null)?.nome;
  const sdrNome = (pedido.sdr as unknown as { nome: string } | null)?.nome;
  const closerNome = (pedido.closer as unknown as { nome: string } | null)?.nome;
  const planoLabel = buscarPlanoPorKey(pedido.plano)?.canonical ?? pedido.plano;
  const produtoLabel = pedido.produtos.includes("api") ? "Footlink + API" : "Footlink";
  const status = statusPedidoVisual(pedido.status, pedido.geracao_contrato_erro);

  const representantesLegais = signatarios.filter((s) => s.tipo === "representante_legal");
  const donoDoRascunho = pedido.vendedor_id === sessao.id;
  const podeEditar =
    pedidoEhEditavel(pedido.status) && (sessao.papel === "admin" || (sessao.papel === "vendedor" && donoDoRascunho));
  const podeCancelar =
    pedido.status !== "concluido" &&
    pedido.status !== "cancelado" &&
    (sessao.papel === "admin" || sessao.papel === "juridico" || (sessao.papel === "vendedor" && donoDoRascunho));
  const proxima = acaoPendente(pedido.status, sessao.papel, donoDoRascunho);

  const alertas = gerarAlertas({
    valorMensal: pedido.valor_mensal,
    valorTotal: pedido.valor_total,
    formaPagamento: pedido.forma_pagamento,
    numeroParcelas: pedido.numero_parcelas ?? undefined,
    licencasGratuitas: pedido.licencas_gratuitas,
    foro: pedido.foro,
    temRepresentanteLegal: representantesLegais.length > 0,
    planoLegadoDetectado: pedido.plano_legado_detectado,
    planoLegadoNomeOriginal: pedido.plano_legado_nome_original,
    planoLegadoConfirmado: pedido.plano_legado_detectado,
  });

  const contratosComUrl = await Promise.all(
    contratos.map(async (c) => {
      const nomeDownload = nomeArquivoContrato(cliente?.razao_social ?? "Cliente", c.gerado_em, c.versao);
      const { data } = await supabase.storage.from("contratos").createSignedUrl(c.arquivo_path, 3600, { download: nomeDownload });
      let urlAssinado: string | null = null;
      if (c.arquivo_assinado_path) {
        const { data: assinado } = await supabase.storage
          .from("contratos")
          .createSignedUrl(c.arquivo_assinado_path, 3600, { download: nomeDownload.replace(/\.docx$/, ".pdf") });
        urlAssinado = assinado?.signedUrl ?? null;
      }
      return { ...c, url: data?.signedUrl ?? null, urlAssinado };
    }),
  );
  const contratoAtual = contratosComUrl[0] ?? null;
  // Prazo expirou / documento finalizado com signatários pendentes (0028).
  const assinaturaIncompleta = !!contratoAtual?.assinatura_incompleta;

  const {
    signatarios: signatariosExibidos,
    temStatusPorSignatario,
    assinados,
    naoAssinaram,
  } = await carregarSignatariosExibidos(supabase, detalhe, contratoAtual);

  const { etapas, atual, canceladoEm } = montarEtapasNegocio({
    status: pedido.status,
    criadoEm: pedido.criado_em,
    transicoes,
    versaoContrato: contratoAtual?.versao ?? null,
    geracaoContratoErro: pedido.geracao_contrato_erro,
    assinaturas: temStatusPorSignatario ? { assinados, total: signatariosExibidos.length, encerrada: assinaturaIncompleta } : null,
  });

  // "criado" não vira uma linha em `transicoes` (o pedido nasce em rascunho sem RPC) — sintetiza
  // esse evento a partir de pedidos.vendedor_id/criado_em pra não perder quem abriu o pedido no histórico.
  const eventosTimeline: EventoTimeline[] = [
    { id: "criado", data: pedido.criado_em, nome: vendedorNome ?? "—", titulo: "Pedido criado" },
    ...transicoes.map((t) => ({
      id: t.id,
      data: t.criado_em,
      nome: (t.profiles as unknown as { nome: string } | null)?.nome ?? "—",
      titulo: `${t.de ? ROTULO_STATUS[t.de] : "Criado"} → ${ROTULO_STATUS[t.para]}`,
      comentario: t.comentario,
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const assinado = pedido.status === "assinado" || pedido.status === "concluido";

  return (
    <div className="flex max-w-[1400px] flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <BotaoVoltar href={VOLTAR_POR_PAPEL[sessao.papel]} />
        <LogoCliente url={urlLogoCliente(supabase, cliente?.logo_path ?? null)} nome={nomeCliente} tamanho="lg" />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.01em] text-darkPurple1">{nomeCliente}</h1>
            <BadgeLinha />
            <StatusPill tom={status.tom}>{status.rotulo}</StatusPill>
          </div>
          <span className="text-sm text-gray">
            {ROTULO_PERFIL_CLIENTE[pedido.perfil]} • {planoLabel} • {formatarMoeda(pedido.valor_total)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {podeEditar && (
            <Button variant="white" nativeButton={false} render={<Link href={`/vendedor/${pedido.id}/editar`} />}>
              <MdEdit className="size-4" />
              Editar dados
            </Button>
          )}
          {podeCancelar && <CancelarPedidoDialog pedidoId={pedido.id} />}
          <AcoesPedido pedidoId={pedido.id} status={pedido.status} papel={sessao.papel} donoDoRascunho={donoDoRascunho} escopo="pedido" />
        </div>
      </div>

      {/* Stepper */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card">
        {canceladoEm !== null && (
          <div className="flex items-center gap-2 text-sm font-bold text-red">
            <MdBlock className="size-5" />
            Pedido cancelado — o fluxo parou na etapa destacada.
          </div>
        )}
        <Stepper etapas={etapas} atual={atual} className={canceladoEm !== null ? "opacity-60" : undefined} />
        {proxima && (
          <div className="flex items-start gap-2.5 rounded-lg bg-lightPurple4 px-4 py-3 text-sm">
            <MdInfo className="mt-0.5 size-4 shrink-0 text-purple-text" />
            <span className="text-darkPurple1">
              <strong className="font-bold">{proxima.titulo}.</strong> {proxima.descricao}
            </span>
          </div>
        )}
      </div>

      <PainelAlertas alertas={alertas} />
      {pedido.geracao_contrato_erro && (
        <p className="rounded-xl border border-red/30 bg-dangerBg px-5 py-4 text-sm text-red">
          Última tentativa de geração falhou: {pedido.geracao_contrato_erro}
        </p>
      )}

      {/* Coluna principal = o fluxo (pedido → contrato → parcelas); lateral =
          referência (cliente + histórico). Cada coluna empilha seus cards de
          forma independente, sem buracos entre cards de alturas diferentes. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo icone={MdReceipt} cor="bg-iconGreen" titulo="Pedido de venda" extra={<StatusPill tom={status.tom}>{status.rotulo}</StatusPill>}>
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              {/* Nº do pedido vem do Bling (decisão de produto); o envio ao Bling ainda é stub. */}
              <LinhaChaveValor rotulo="Número" valor={<span title="Atribuído pelo Bling quando o pedido for enviado">—</span>} />
              <LinhaChaveValor rotulo="Emissão" valor={formatarDataCurta(pedido.criado_em)} />
              <LinhaChaveValor rotulo="Plano" valor={`${produtoLabel} · ${planoLabel}`} />
              <LinhaChaveValor
                rotulo="Licenças"
                valor={`${pedido.licencas_pagas} pagas${pedido.licencas_gratuitas > 0 ? ` + ${pedido.licencas_gratuitas} gratuita(s)` : ""}`}
              />
              <LinhaChaveValor rotulo="Pagamento" valor={rotuloPagamento(pedido.forma_pagamento, pedido.meio_pagamento, pedido.numero_parcelas)} />
              <LinhaChaveValor
                rotulo="Parcela"
                valor={pedido.forma_pagamento === "parcelado" ? `${pedido.numero_parcelas}x de ${formatarMoeda(pedido.valor_mensal)}` : formatarMoeda(pedido.valor_mensal)}
              />
              <LinhaChaveValor rotulo="Valor total" valor={formatarMoeda(pedido.valor_total)} />
              {pedido.produtos.includes("api") && (
                <LinhaChaveValor rotulo="API / Software" valor={`${formatarMoeda(pedido.valor_mensal_api)} / ${formatarMoeda(pedido.valor_mensal_software)}`} />
              )}
              {!!pedido.valor_licenca_adicional && <LinhaChaveValor rotulo="Licença adicional" valor={formatarMoeda(pedido.valor_licenca_adicional)} />}
              <LinhaChaveValor rotulo="Vigência" valor={`${formatarDataCurta(pedido.vigencia_inicio)} a ${formatarDataCurta(pedido.vigencia_fim)}`} />
              <LinhaChaveValor rotulo="Tipo de venda" valor={pedido.tipo_venda ? ROTULO_TIPO_VENDA[pedido.tipo_venda] : <span className="text-gray3">não informado</span>} />
              <LinhaChaveValor rotulo="Origem" valor={pedido.origem ? ROTULO_ORIGEM_VENDA[pedido.origem] : <span className="text-gray3">não informada</span>} />
              {pedido.condicao_especial && <LinhaChaveValor rotulo="Condição especial" valor={pedido.condicao_especial} longo className="md:col-span-2" />}
            </div>
          </CardModulo>

          <CardModulo
            icone={MdGavel}
            cor="bg-iconPurple"
            titulo="Contrato"
            extra={contratoAtual ? <span className="text-sm font-semibold text-gray3">v{contratoAtual.versao}</span> : undefined}
          >
            {!contratoAtual ? (
              <EstadoVazio
                compacto
                icone={MdGavel}
                titulo={pedido.geracao_contrato_erro ? "Falha ao gerar o contrato" : "Contrato ainda não gerado"}
                descricao={
                  pedido.geracao_contrato_erro
                    ? "Corrija o problema indicado acima e tente gerar novamente."
                    : "O contrato é gerado automaticamente do modelo quando a diretoria aprova o pedido."
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {assinaturaIncompleta && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red/30 bg-dangerBg px-4 py-3 text-sm text-red">
                    <MdWarning className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong className="font-bold">
                        Assinatura encerrada sem todas as assinaturas
                        {contratoAtual.assinatura_encerrada_em ? ` em ${formatarDataCurta(contratoAtual.assinatura_encerrada_em)}` : ""}.
                      </strong>{" "}
                      Não assinaram: {naoAssinaram.map((s) => s.nome).join(", ")}.
                    </span>
                  </div>
                )}

                <div className="flex flex-col">
                  <LinhaChaveValor rotulo="Modelo" valor={MODELO_CONTRATO[pedido.perfil]} />
                  <LinhaChaveValor rotulo="Gerado em" valor={formatarDataCurta(contratoAtual.gerado_em)} />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Assinaturas · Clicksign</span>
                    <span className="text-xs font-semibold text-gray2">
                      {assinados} de {signatariosExibidos.length}
                    </span>
                  </div>
                  <ListaSignatarios signatarios={signatariosExibidos} />
                  {!temStatusPorSignatario && pedido.status === "enviado_para_assinatura" && (
                    <p className="text-xs text-gray3">Enviado antes do acompanhamento individual — o status por pessoa não está disponível para este envio.</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
                    {contratosComUrl.some((c) => c.urlAssinado) ? "Documento assinado" : "Versões"}
                  </span>
                  {contratosComUrl.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border-b border-gray5 pb-2 last:border-0 last:pb-0">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold text-darkPurple1">
                          Versão {c.versao} · {formatarDataCurta(c.gerado_em)}
                        </span>
                        {c.motivo_versao && <span className="truncate text-xs text-gray3">{c.motivo_versao}</span>}
                      </div>
                      {/* Depois de assinado, só o PDF assinado fica disponível — o .docx original deixa de ser o documento válido. */}
                      {c.urlAssinado ? (
                        <Button variant="secondary" size="sm" nativeButton={false} render={<a href={c.urlAssinado} target="_blank" rel="noreferrer" />}>
                          <MdDownload className="size-4" />
                          PDF assinado
                        </Button>
                      ) : (
                        c.url && (
                          <Button variant="white" size="sm" nativeButton={false} render={<a href={c.url} target="_blank" rel="noreferrer" />}>
                            <MdDownload className="size-4" />
                            Baixar
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações do jurídico sobre o contrato (liberar, regenerar, nova versão, Clicksign) ficam no contexto do contrato. */}
            <div className="border-t border-gray5 pt-4 empty:hidden">
              <AcoesPedido pedidoId={pedido.id} status={pedido.status} papel={sessao.papel} donoDoRascunho={donoDoRascunho} escopo="contrato" />
            </div>
          </CardModulo>

          <CardModulo icone={MdAttachMoney} cor="bg-iconYellow" titulo="Parcelas">
            {/* Ainda não há integração pedido → Bling (bling_pedido_id nunca é
                preenchido). Pedidos já assinados tiveram as cobranças criadas
                direto no Bling, fora do sistema. */}
            {assinado ? (
              <EstadoVazio
                compacto
                icone={MdAttachMoney}
                titulo="Parcelas geradas fora do sistema"
                descricao="As cobranças deste pedido foram criadas diretamente no Bling, antes da integração do pedido com o Bling."
              />
            ) : (
              <EstadoVazio
                compacto
                icone={MdAttachMoney}
                titulo="Parcelas não geradas"
                descricao="As cobranças serão criadas no Bling após a assinatura do contrato."
              />
            )}
          </CardModulo>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <CardModulo
            icone={MdBusiness}
            cor="bg-iconBlue"
            titulo="Cliente"
            extra={
              cliente && sessao.papel !== "juridico" ? (
                <Link href={`/clientes/${cliente.id}`} className="text-sm font-semibold text-purple-text hover:underline">
                  Ver cliente
                </Link>
              ) : undefined
            }
          >
            <div className="flex flex-col">
              <LinhaChaveValor rotulo="Razão social" valor={cliente?.razao_social} />
              <LinhaChaveValor rotulo="CNPJ" valor={cliente ? formatarCnpj(cliente.cnpj) : null} />
              <LinhaChaveValor rotulo="Perfil" valor={ROTULO_PERFIL_CLIENTE[pedido.perfil]} />
              <LinhaChaveValor rotulo="Endereço" valor={cliente ? formatarEnderecoCliente(cliente) : null} longo />
              <LinhaChaveValor rotulo="Vendedor" valor={vendedorNome} />
              <LinhaChaveValor rotulo="SDR" valor={sdrNome} />
              <LinhaChaveValor rotulo="Closer" valor={closerNome} />
            </div>
          </CardModulo>

          <CardModulo icone={MdHistory} cor="bg-iconGray" titulo="Linha do tempo">
            <TimelineTransicoes eventos={eventosTimeline} />
          </CardModulo>
        </div>
      </div>
    </div>
  );
}

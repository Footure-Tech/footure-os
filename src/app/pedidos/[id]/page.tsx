import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, Package, Users, FileStack, History, Pencil, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { buscarPedidoDetalhe } from "@/lib/pedidos/consultas";
import { pedidoEhEditavel } from "@/lib/pedidos/statusEditavel";
import { Button } from "@/components/ui/button";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { gerarAlertas } from "@/lib/validacoes/pedido";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { ROTULO_MEIO_PAGAMENTO } from "@/lib/contratos/meioPagamento";
import { nomeArquivoContrato } from "@/lib/contratos/nomeArquivo";
import { RotuloStatus, ROTULO_STATUS } from "@/components/rotulo-status";
import { PainelAlertas } from "@/components/pedido/painel-alertas";
import { StepperPedido } from "@/components/pedido/stepper-pedido";
import { ProximaAcao } from "@/components/pedido/proxima-acao";
import { CancelarPedidoDialog } from "@/components/pedido/cancelar-pedido-dialog";
import { BlocoFormulario } from "@/components/pedido/bloco-formulario";
import { InfoRow } from "@/components/pedido/info-row";
import { ListaPessoas } from "@/components/pedido/lista-pessoas";
import { TimelineTransicoes, type EventoTimeline } from "@/components/pedido/timeline-transicoes";

function formatarMoeda(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}
/** vigencia_inicio/fim vêm como "aaaa-mm-dd" (coluna `date`) — divide a string em vez de
 * usar Date pra não sofrer o deslocamento de fuso horário do parse UTC-meia-noite. */
function formatarDataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function DetalhePedidoPage({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const sessao = await exigirPapel("vendedor", "juridico", "admin");
  const supabase = await createClient();

  const detalhe = await buscarPedidoDetalhe(supabase, id);
  if (!detalhe) notFound();
  const { pedido, transicoes, contratos, signatarios, representantesFooture, testemunhasFooture } = detalhe;

  const cliente = pedido.clientes as unknown as {
    razao_social: string;
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
    foro_preferencial: string;
    logo_path: string | null;
  } | null;
  const logoClienteUrl = urlLogoCliente(supabase, cliente?.logo_path ?? null);
  const vendedorNome = (pedido.profiles as unknown as { nome: string } | null)?.nome;
  const sdrNome = (pedido.sdr as unknown as { nome: string } | null)?.nome;
  const closerNome = (pedido.closer as unknown as { nome: string } | null)?.nome;
  const planoLabel = buscarPlanoPorKey(pedido.plano)?.canonical ?? pedido.plano;

  const representantesLegais = signatarios.filter((s) => s.tipo === "representante_legal");
  const testemunhasCliente = signatarios.filter((s) => s.tipo === "testemunha");
  const donoDoRascunho = pedido.vendedor_id === sessao.id;
  const podeEditar =
    pedidoEhEditavel(pedido.status) && (sessao.papel === "admin" || (sessao.papel === "vendedor" && donoDoRascunho));
  const podeCancelar =
    pedido.status !== "concluido" &&
    pedido.status !== "cancelado" &&
    (sessao.papel === "admin" || sessao.papel === "juridico" || (sessao.papel === "vendedor" && donoDoRascunho));

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
      const { data } = await supabase.storage
        .from("contratos")
        .createSignedUrl(c.arquivo_path, 3600, { download: nomeDownload });

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
  const contratoAssinado = contratosComUrl.some((c) => c.urlAssinado);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{cliente?.razao_social ?? "Pedido"}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {pedido.perfil} · {planoLabel} · vendedor: {vendedorNome ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RotuloStatus status={pedido.status} />
          {podeEditar && (
            <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/vendedor/${pedido.id}/editar`} />}>
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
          {podeCancelar && <CancelarPedidoDialog pedidoId={pedido.id} />}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <StepperPedido status={pedido.status} />
      </div>

      <ProximaAcao pedidoId={pedido.id} status={pedido.status} papel={sessao.papel} donoDoRascunho={donoDoRascunho} />

      <PainelAlertas alertas={alertas} />
      {pedido.geracao_contrato_erro && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Última tentativa de geração falhou: {pedido.geracao_contrato_erro}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BlocoFormulario numero={1} titulo="Cliente" icon={Building2}>
          <div className="flex flex-col gap-4">
            <LogoCliente url={logoClienteUrl} nome={cliente?.razao_social ?? "Cliente"} tamanho="md" />
            <div className="flex flex-col">
              <InfoRow label="Razão social" value={cliente?.razao_social} />
              <InfoRow label="CNPJ" value={cliente?.cnpj} />
              <InfoRow label="Endereço" value={cliente ? formatarEnderecoCliente(cliente) : undefined} longo />
            </div>
          </div>
        </BlocoFormulario>

        <BlocoFormulario numero={2} titulo="Produto e valores" icon={Package}>
          <div className="flex flex-col">
            <InfoRow label="Produtos" value={pedido.produtos.includes("api") ? "Footlink + API" : "Footlink"} />
            <InfoRow
              label="Licenças"
              value={`${pedido.licencas_pagas} pagas${pedido.licencas_gratuitas > 0 ? ` + ${pedido.licencas_gratuitas} gratuita(s)` : ""}`}
            />
            <InfoRow
              label="Forma de pagamento"
              value={`${pedido.forma_pagamento === "avista" ? "À vista" : `Parcelado (${pedido.numero_parcelas}x)`} · ${ROTULO_MEIO_PAGAMENTO[pedido.meio_pagamento]}`}
            />
            <InfoRow label="Valor da parcela" value={formatarMoeda(pedido.valor_mensal)} />
            <InfoRow label="Valor total" value={formatarMoeda(pedido.valor_total)} />
            <InfoRow label="SDR" value={sdrNome} />
            <InfoRow label="Closer" value={closerNome} />
            {pedido.produtos.includes("api") && (
              <InfoRow
                label="API / Software"
                value={`${formatarMoeda(pedido.valor_mensal_api)} / ${formatarMoeda(pedido.valor_mensal_software)}`}
              />
            )}
            <InfoRow label="Vigência" value={`${formatarDataBr(pedido.vigencia_inicio)} a ${formatarDataBr(pedido.vigencia_fim)}`} />
            <InfoRow label="Foro" value={pedido.foro} />
            <InfoRow label="Multa" value={pedido.multa_texto} longo />
            {pedido.condicao_especial && <InfoRow label="Condição especial" value={pedido.condicao_especial} longo />}
          </div>
        </BlocoFormulario>

        <BlocoFormulario numero={3} titulo="Signatários" icon={Users}>
          <div className="flex flex-col gap-4">
            <ListaPessoas
              titulo="Representantes legais do cliente"
              pessoas={representantesLegais.map((s) => {
                const sc = s.signatarios_cliente as unknown as { nome_completo: string; email: string; cpf: string } | null;
                return { nome: sc?.nome_completo ?? "—", email: sc?.email, cpf: sc?.cpf };
              })}
            />
            <ListaPessoas
              titulo="Testemunhas do cliente"
              pessoas={testemunhasCliente.map((s) => {
                const sc = s.signatarios_cliente as unknown as { nome_completo: string; email: string; cpf: string } | null;
                return { nome: sc?.nome_completo ?? "—", email: sc?.email, cpf: sc?.cpf };
              })}
              vazio="Nenhuma cadastrada."
            />
            <ListaPessoas
              titulo="Representante(s) da Footure"
              pessoas={representantesFooture.map((r) => {
                const rf = r.representantes_footure as unknown as { nome: string; email: string | null; cpf: string | null } | null;
                return { nome: rf?.nome ?? "—", email: rf?.email, cpf: rf?.cpf };
              })}
              vazio="Nenhum selecionado."
            />
            <ListaPessoas
              titulo="Testemunhas da Footure"
              pessoas={testemunhasFooture.map((t) => ({ nome: t.nome_completo, email: t.email, cpf: t.cpf }))}
              vazio="Nenhuma cadastrada."
            />
          </div>
        </BlocoFormulario>

        <BlocoFormulario numero={4} titulo={contratoAssinado ? "Contrato assinado" : "Versões do contrato"} icon={FileStack}>
          <div className="flex flex-col gap-2 text-sm">
            {contratosComUrl.length === 0 && <p className="text-muted-foreground">Nenhum contrato gerado ainda.</p>}
            {contratosComUrl.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <div>
                  <p>
                    Versão {c.versao} · {formatarData(c.gerado_em)}
                  </p>
                  {c.motivo_versao && <p className="text-xs text-muted-foreground">{c.motivo_versao}</p>}
                </div>
                {/* Depois de assinado, só o PDF assinado fica disponível — o .docx
                    original deixa de ser o documento válido. */}
                {c.urlAssinado ? (
                  <Button variant="secondary" size="sm" nativeButton={false} render={<a href={c.urlAssinado} target="_blank" rel="noreferrer" />}>
                    <Download className="size-4" />
                    Baixar PDF assinado
                  </Button>
                ) : (
                  c.url && (
                    <Button variant="secondary" size="sm" nativeButton={false} render={<a href={c.url} target="_blank" rel="noreferrer" />}>
                      <Download className="size-4" />
                      Baixar
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </BlocoFormulario>
      </div>

      <BlocoFormulario numero={5} titulo="Linha do tempo" icon={History}>
        <TimelineTransicoes eventos={eventosTimeline} />
      </BlocoFormulario>
    </div>
  );
}

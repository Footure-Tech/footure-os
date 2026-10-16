import Link from "next/link";
import { MdDownload, MdGavel, MdOpenInNew, MdWarning } from "react-icons/md";
import { exigirPapel } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buscarPedidoDetalhe, listarContratosJuridico } from "@/lib/pedidos/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { carregarSignatariosExibidos } from "@/lib/contratos/signatariosExibidos";
import { nomeArquivoContrato } from "@/lib/contratos/nomeArquivo";
import { ITENS_VALIDACAO } from "@/lib/contratos/validacao";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { statusPedidoVisual } from "@/lib/status/visual";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import type { StatusPedido } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { BadgeLinha } from "@/components/ds/badge-tom";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { ListaSignatarios } from "@/components/negocio/lista-signatarios";
import { ChecklistValidacao } from "@/components/contratos/checklist-validacao";
import { AnaliseVersaoContrato } from "@/components/contratos/analise-versao";
import { carregarAnaliseVersao } from "@/lib/contratos/consultasAnalise";
import { AcoesPedido } from "@/components/pedido/acoes-pedido";
import { cn } from "@/lib/utils";

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

const MODELO_CONTRATO = { clube: "Footlink Clube", agente: "Footlink Agente" } as const;

function Secao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-gray5 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{titulo}</span>
        {extra}
      </div>
      {children}
    </section>
  );
}

// Tela "Contratos" do handoff (Jurídico): abas por etapa + mestre-detalhe.
// A seleção fica na URL (?aba=&sel=) — a página continua Server Component.
export default async function ContratosJuridicoPage({ searchParams }: PageProps<"/juridico">) {
  const sessao = await exigirPapel("juridico", "admin");
  const { aba: abaParam, sel } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === abaParam) ? (abaParam as Aba) : "todos";
  const supabase = await createClient();

  const todos = (await listarContratosJuridico(supabase)).map((p) => {
    const versoes = (p.contratos as unknown as { id: string; versao: number; gerado_em: string }[] | null) ?? [];
    return { ...p, contrato: versoes.reduce<(typeof versoes)[number] | null>((maior, c) => (!maior || c.versao > maior.versao ? c : maior), null) };
  });
  const filtrados = todos.filter((p) => naAba(aba, p.status));
  const selecionado = filtrados.find((p) => p.id === sel) ?? filtrados[0] ?? null;
  const hrefAba = (valor: string, id?: string) => `/juridico?aba=${valor}${id ? `&sel=${id}` : ""}`;

  // Painel de detalhe do contrato selecionado.
  const detalhe = selecionado ? await buscarPedidoDetalhe(supabase, selecionado.id) : null;
  const contratoAtual = detalhe?.contratos[0] ?? null;
  const painel = detalhe
    ? await (async () => {
        const cliente = detalhe.pedido.clientes as unknown as { razao_social: string; nome_fantasia: string | null } | null;
        const assinaturas = await carregarSignatariosExibidos(supabase, detalhe, contratoAtual);
        const { data: marcacoes } = contratoAtual
          ? await supabase.from("contrato_validacao").select("item, marcado_em, marcado_por").eq("contrato_id", contratoAtual.id)
          : { data: [] };
        const idsAutores = [...new Set((marcacoes ?? []).map((m) => m.marcado_por).filter((id): id is string => !!id))];
        const { data: autores } = idsAutores.length
          ? await supabase.from("profiles").select("user_id, nome").in("user_id", idsAutores)
          : { data: [] };
        const nomeAutor = new Map((autores ?? []).map((a) => [a.user_id, a.nome]));

        let urlDownload: string | null = null;
        if (contratoAtual) {
          const nome = nomeArquivoContrato(cliente?.razao_social ?? "Cliente", contratoAtual.gerado_em, contratoAtual.versao);
          const caminho = contratoAtual.arquivo_assinado_path ?? contratoAtual.arquivo_path;
          const { data } = await supabase.storage
            .from("contratos")
            .createSignedUrl(caminho, 3600, { download: contratoAtual.arquivo_assinado_path ? nome.replace(/\.docx$/, ".pdf") : nome });
          urlDownload = data?.signedUrl ?? null;
        }
        return {
          nomeCliente: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
          analise: contratoAtual ? await carregarAnaliseVersao(supabase, contratoAtual.id) : null,
          assinaturas,
          marcados: (marcacoes ?? []).map((m) => ({
            item: m.item,
            marcadoEm: m.marcado_em,
            marcadoPor: m.marcado_por ? (nomeAutor.get(m.marcado_por) ?? null) : null,
          })),
          urlDownload,
        };
      })()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Jurídico"
        titulo="Assinatura de contratos"
        descricao="Geração a partir do pedido de venda, validação jurídica e assinatura eletrônica via Clicksign."
      />

      <AbasFiltro
        valor={aba}
        opcoes={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo, href: hrefAba(a.valor), contagem: todos.filter((p) => naAba(a.valor, p.status)).length }))}
      />

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdGavel} titulo="Nenhum contrato nesta etapa" descricao="Os contratos aparecem aqui assim que a diretoria aprova o pedido de venda." />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-5">
          {/* Lista */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const cliente = p.clientes as unknown as { razao_social: string; nome_fantasia: string | null; logo_path: string | null } | null;
                const nome = cliente?.nome_fantasia || cliente?.razao_social || "—";
                const status = statusPedidoVisual(p.status, p.geracao_contrato_erro);
                const ativo = p.id === selecionado?.id;
                return (
                  <LinhaClicavel
                    key={p.id}
                    href={hrefAba(aba, p.id)}
                    manterRolagem
                    aria-current={ativo ? "true" : undefined}
                    className={cn(ativo && "bg-lightPurple4 shadow-[inset_3px_0_0_var(--lightPurple1)] hover:bg-lightPurple4")}
                  >
                    <TableCell className="max-w-[240px] whitespace-normal">
                      <div className="flex items-center gap-3">
                        <LogoCliente url={urlLogoCliente(supabase, cliente?.logo_path ?? null)} nome={nome} />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-bold text-purple-text">{nome}</span>
                          <span className="text-xs text-gray3">
                            {p.contrato ? `v${p.contrato.versao} · ${formatarDataCurta(p.contrato.gerado_em)}` : "Sem contrato gerado"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <BadgeLinha className={ativo ? "bg-surface" : undefined} />
                        <span className="text-xs text-gray2">{buscarPlanoPorKey(p.plano)?.canonical ?? p.plano}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-darkPurple1">{formatarMoeda(p.valor_total)}</TableCell>
                    <TableCell>
                      <StatusPill tom={status.tom}>{status.rotulo}</StatusPill>
                    </TableCell>
                  </LinhaClicavel>
                );
              })}
            </TableBody>
          </Table>

          {/* Painel de detalhe */}
          {detalhe && painel && (
            <aside className="flex flex-col gap-5 rounded-xl border border-gray5 bg-surface p-6 shadow-card lg:sticky lg:top-[90px]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-gray3">{contratoAtual ? `Contrato v${contratoAtual.versao}` : "Contrato"}</span>
                  {(() => {
                    const s = statusPedidoVisual(detalhe.pedido.status, detalhe.pedido.geracao_contrato_erro);
                    return <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>;
                  })()}
                </div>
                <h2 className="text-xl font-bold text-darkPurple1">{painel.nomeCliente}</h2>
                <span className="text-sm text-gray">Modelo {MODELO_CONTRATO[detalhe.pedido.perfil]}</span>
                <span className="text-sm text-gray">
                  Pedido Bling {detalhe.pedido.bling_pedido_numero ? `nº ${detalhe.pedido.bling_pedido_numero}` : "—"} · Valor {formatarMoeda(detalhe.pedido.valor_total)}
                </span>
              </div>

              {!contratoAtual ? (
                <EstadoVazio
                  compacto
                  icone={MdGavel}
                  titulo={detalhe.pedido.geracao_contrato_erro ? "Falha ao gerar o contrato" : "Contrato em geração"}
                  descricao={detalhe.pedido.geracao_contrato_erro ?? "O contrato é gerado automaticamente do modelo após a aprovação do pedido."}
                />
              ) : (
                <>
                  <Secao
                    titulo="Validação jurídica"
                    extra={
                      <span className="text-xs font-semibold text-gray2">
                        {painel.marcados.length} de {ITENS_VALIDACAO.length}
                      </span>
                    }
                  >
                    <ChecklistValidacao
                      pedidoId={detalhe.pedido.id}
                      contratoId={contratoAtual.id}
                      marcados={painel.marcados}
                      editavel={detalhe.pedido.status === "em_revisao_juridica"}
                    />
                  </Secao>

                  {painel.analise && (
                    <AnaliseVersaoContrato analise={painel.analise} versao={contratoAtual.versao} editavel={detalhe.pedido.status === "em_revisao_juridica"} />
                  )}

                  <Secao
                    titulo="Assinaturas · Clicksign"
                    extra={
                      <span className="text-xs font-semibold text-gray2">
                        {painel.assinaturas.assinados} de {painel.assinaturas.signatarios.length}
                      </span>
                    }
                  >
                    {contratoAtual.assinatura_incompleta && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-red/30 bg-dangerBg px-4 py-3 text-sm text-red">
                        <MdWarning className="mt-0.5 size-4 shrink-0" />
                        <span>
                          <strong className="font-bold">Assinatura encerrada sem todas as assinaturas.</strong> Não assinaram:{" "}
                          {painel.assinaturas.naoAssinaram.map((s) => s.nome).join(", ")}.
                        </span>
                      </div>
                    )}
                    <ListaSignatarios signatarios={painel.assinaturas.signatarios} />
                  </Secao>
                </>
              )}

              <div className="flex flex-col gap-2.5 border-t border-gray5 pt-5">
                <AcoesPedido
                  pedidoId={detalhe.pedido.id}
                  status={detalhe.pedido.status}
                  papel={sessao.papel}
                  donoDoRascunho={false}
                  escopo="contrato"
                />
                <div className="flex flex-wrap gap-2.5 *:min-w-[160px] *:flex-1">
                  <Button variant="white" nativeButton={false} render={<Link href={`/pedidos/${detalhe.pedido.id}`} />}>
                    <MdOpenInNew className="size-[18px]" />
                    Ver negócio
                  </Button>
                  {painel.urlDownload && (
                    <Button variant="white" nativeButton={false} render={<a href={painel.urlDownload} target="_blank" rel="noreferrer" />}>
                      <MdDownload className="size-[18px]" />
                      {contratoAtual?.arquivo_assinado_path ? "Baixar PDF assinado" : "Baixar contrato"}
                    </Button>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

import { MdMarkEmailUnread, MdPeople, MdWarning } from "react-icons/md";
import type { AbaCobranca, carregarTelaCobranca } from "@/lib/cobranca/consultas";
import { rotuloEtapa } from "@/lib/cobranca/regras";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoGerarAgora, DialogRegraCliente, FormConfiguracaoCobranca, ListaAguardando } from "./acoes-cobranca";
import { ENTREGA_VISUAL, ROTULO_TIPO_ENVIO, STATUS_ENVIO_VISUAL, TOM_TIPO_ENVIO } from "./visual";

type Dados = Awaited<ReturnType<typeof carregarTelaCobranca>>;

const ROTULO_MODO = { desligado: "Régua desligada", aprovacao: "Com aprovação", automatico: "Automática" } as const;
const TOM_MODO = { desligado: "not_started", aprovacao: "pending", automatico: "active" } as const;

function Aviso({ children, tom = "atencao" }: { children: React.ReactNode; tom?: "atencao" | "erro" }) {
  return (
    <div className={tom === "erro" ? "flex items-start gap-2.5 rounded-xl border border-red/30 bg-dangerBg px-5 py-3.5 text-sm text-red" : "flex items-start gap-2.5 rounded-xl border border-orange/40 bg-orange3 px-5 py-3.5 text-sm text-[#ce9232]"}>
      <MdWarning className="mt-0.5 size-[18px] shrink-0" />
      <div className="font-semibold">{children}</div>
    </div>
  );
}

// Financeiro · Régua de cobrança (F1): aprovação dos e-mails do dia, histórico,
// regras por cliente e configuração.
export function TelaCobranca({ dados, aba }: { dados: Dados; aba: AbaCobranca }) {
  const { config, aguardando, historico, problemasEntrega, clientes } = dados;
  const desligada = config.modo === "desligado";
  const reguaTexto = config.regua_dias.map(rotuloEtapa).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Financeiro"
        titulo="Régua de cobrança"
        descricao={`Lembretes e cobranças de atraso por e-mail aos clientes do Footlink · régua ${reguaTexto} · escalonamento em D+${config.escalonamento_dias}`}
        acoes={
          <>
            <StatusPill tom={TOM_MODO[config.modo]}>{ROTULO_MODO[config.modo]}</StatusPill>
            <BotaoGerarAgora desabilitado={desligada || !config.data_corte} />
          </>
        }
      />

      {config.email_teste && !desligada && (
        <Aviso>Modo de teste ativo: os e-mails aos clientes estão indo só para {config.email_teste}.</Aviso>
      )}
      {desligada && <Aviso>A régua está desligada: nenhum e-mail é gerado. Revise os textos e a configuração e ligue na aba Configuração.</Aviso>}
      {problemasEntrega.length > 0 && (
        <Aviso tom="erro">
          {problemasEntrega.length} {problemasEntrega.length === 1 ? "e-mail não chegou" : "e-mails não chegaram"} ao cliente (devolvido ou marcado como spam) nos últimos 60 dias — confira os
          destinatários no Histórico.
        </Aviso>
      )}

      <AbasFiltro
        valor={aba}
        opcoes={[
          { valor: "aprovacao", rotulo: "Aguardando aprovação", href: "/financeiro/cobranca", contagem: aguardando.length },
          { valor: "historico", rotulo: "Histórico", href: "/financeiro/cobranca?aba=historico" },
          { valor: "clientes", rotulo: "Clientes", href: "/financeiro/cobranca?aba=clientes", contagem: clientes.length },
          { valor: "configuracao", rotulo: "Configuração", href: "/financeiro/cobranca?aba=configuracao" },
        ]}
      />

      {aba === "aprovacao" &&
        (aguardando.length === 0 ? (
          <div className="rounded-xl border border-gray5 bg-surface shadow-table">
            <EstadoVazio
              icone={MdMarkEmailUnread}
              titulo="Nenhum e-mail aguardando"
              descricao={desligada ? "Com a régua ligada, os e-mails do dia aparecem aqui às 9h." : "Os e-mails do dia aparecem aqui às 9h (ou use “Gerar envios de hoje”)."}
            />
          </div>
        ) : (
          <ListaAguardando envios={aguardando} modo={config.modo} />
        ))}

      {aba === "historico" &&
        (historico.length === 0 ? (
          <div className="rounded-xl border border-gray5 bg-surface shadow-table">
            <EstadoVazio icone={MdMarkEmailUnread} titulo="Nenhum envio nos últimos 60 dias" />
          </div>
        ) : (
          <Table minWidth={1000}>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-gray2">{formatarDataCurta(e.enviado_em ?? e.data_prevista)}</TableCell>
                  <TableCell className="max-w-[240px] font-bold whitespace-normal text-darkPurple1">{e.cliente}</TableCell>
                  <TableCell>
                    <StatusPill tom={TOM_TIPO_ENVIO[e.tipo]}>{ROTULO_TIPO_ENVIO[e.tipo]}</StatusPill>
                  </TableCell>
                  <TableCell className="text-gray2">{e.itens.length}</TableCell>
                  <TableCell className="font-semibold text-darkPurple1">{formatarMoeda(e.total)}</TableCell>
                  <TableCell className="max-w-[260px] text-xs whitespace-normal text-gray2">{e.destinatarios.join(", ") || "—"}</TableCell>
                  <TableCell title={e.erro ?? undefined}>
                    <StatusPill tom={STATUS_ENVIO_VISUAL[e.status].tom}>{STATUS_ENVIO_VISUAL[e.status].rotulo}</StatusPill>
                  </TableCell>
                  <TableCell title={e.entrega_detalhe ?? undefined}>
                    {e.entrega ? <StatusPill tom={ENTREGA_VISUAL[e.entrega].tom}>{ENTREGA_VISUAL[e.entrega].rotulo}</StatusPill> : <span className="text-gray3">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}

      {aba === "clientes" &&
        (clientes.length === 0 ? (
          <div className="rounded-xl border border-gray5 bg-surface shadow-table">
            <EstadoVazio icone={MdPeople} titulo="Nenhum cliente com parcela em aberto" />
          </div>
        ) : (
          <Table minWidth={1000}>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Em aberto</TableHead>
                <TableHead>Em atraso</TableHead>
                <TableHead>Próximo vencimento</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Último envio</TableHead>
                <TableHead>Régua</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow key={c.contatoId}>
                  <TableCell className="max-w-[240px] font-bold whitespace-normal text-darkPurple1">{c.nome}</TableCell>
                  <TableCell className="font-semibold text-darkPurple1">{formatarMoeda(c.emAberto)}</TableCell>
                  <TableCell className={c.atrasado ? "font-semibold text-red" : "text-gray3"}>
                    {c.atrasado ? `${formatarMoeda(c.atrasado)} · ${c.maiorAtraso} ${c.maiorAtraso === 1 ? "dia" : "dias"}` : "—"}
                  </TableCell>
                  <TableCell className="text-gray2">{c.proximoVencimento ? formatarDataCurta(c.proximoVencimento) : "—"}</TableCell>
                  <TableCell className="max-w-[240px] text-xs whitespace-normal text-gray2">
                    {c.emails.length ? c.emails.join(", ") : c.regra?.emails_buscados_em ? <span className="font-semibold text-red">sem e-mail no Bling</span> : <span className="text-gray3">lidos no primeiro envio</span>}
                  </TableCell>
                  <TableCell className="text-gray2">
                    {c.ultimoEnvio ? `${ROTULO_TIPO_ENVIO[c.ultimoEnvio.tipo]} · ${formatarDataCurta(c.ultimoEnvio.enviado_em!)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {c.regra?.pausada ? (
                      <span title={c.regra.motivo_pausa ?? undefined}>
                        <StatusPill tom="pending">Pausada</StatusPill>
                      </span>
                    ) : c.regra?.regua_dias ? (
                      <span className="text-xs text-gray2">{c.regra.regua_dias.map(rotuloEtapa).join(", ")}</span>
                    ) : (
                      <span className="text-xs text-gray3">padrão</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DialogRegraCliente cliente={c} reguaPadrao={config.regua_dias} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}

      {aba === "configuracao" && <FormConfiguracaoCobranca config={config} />}
    </div>
  );
}

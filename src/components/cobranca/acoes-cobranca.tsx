"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdDelete, MdEdit, MdMarkEmailRead, MdPlayArrow, MdRefresh, MdSend, MdTune, MdVisibility, MdWarning } from "react-icons/md";
import { exigirSucesso } from "@/lib/resultadoAcao";
import type { CobrancaConfiguracaoRow, ModoCobranca } from "@/lib/supabase/database.types";
import type { ClienteCobranca, EnvioTela } from "@/lib/cobranca/consultas";
import { rotuloEtapa } from "@/lib/cobranca/regras";
import {
  atualizarEmailsDoCliente,
  cobrarAtrasadosAction,
  descartarEnvio,
  enviarEnviosAprovados,
  gerarEnviosAgora,
  previaEnvioCobranca,
  salvarConfiguracaoCobranca,
  salvarRegraCliente,
} from "@/lib/cobranca/serverActions";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CardModulo } from "@/components/negocio/card-modulo";
import { StatusPill } from "@/components/ds/status-pill";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { ROTULO_TIPO_ENVIO, TOM_TIPO_ENVIO } from "./visual";

function erroToast(erro: unknown, padrao: string) {
  toast.error(erro instanceof Error ? erro.message : padrao);
}

export function BotaoGerarAgora({ desabilitado }: { desabilitado: boolean }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={pendente || desabilitado}
      title={desabilitado ? "Ligue a régua (aba Configuração) para gerar envios." : "Roda agora a geração do dia (a mesma do cron das 9h)."}
      onClick={() =>
        iniciar(async () => {
          try {
            const { resumo } = exigirSucesso(await gerarEnviosAgora());
            if (resumo?.ignorado) toast.info(resumo.ignorado);
            else if (resumo) {
              const total = resumo.clientes + resumo.escalonamentos;
              toast.success(total ? `${resumo.clientes} ${resumo.clientes === 1 ? "e-mail gerado" : "e-mails gerados"} para clientes · ${resumo.escalonamentos} escalonamento(s)` : "Nada a enviar hoje.", {
                description: [resumo.enviados && `${resumo.enviados} enviado(s)`, resumo.semEmail && `${resumo.semEmail} sem e-mail`, resumo.falhas && `${resumo.falhas} com falha`].filter(Boolean).join(" · ") || undefined,
              });
            }
            router.refresh();
          } catch (e) {
            erroToast(e, "Falha ao gerar os envios.");
          }
        })
      }
    >
      <MdPlayArrow className="size-[18px]" />
      {pendente ? "Gerando…" : "Gerar envios de hoje"}
    </Button>
  );
}

type ClienteAtrasado = NonNullable<Awaited<ReturnType<typeof cobrarAtrasadosAction>>["clientes"]>[number];

/** "Cobrar atrasados": parcelas vencidas fora da régua (D+15 em diante), desde a data de corte. A janela lista quem entra antes de gerar. */
export function BotaoCobrarAtrasados({ dataCorte, limiteDias }: { dataCorte: string | null; limiteDias: number }) {
  const [aberto, setAberto] = useState(false);
  const [clientes, setClientes] = useState<ClienteAtrasado[] | null>(null);
  const [carregando, carregar] = useTransition();
  const [gerando, gerar] = useTransition();
  const router = useRouter();

  function abrir(valor: boolean) {
    setAberto(valor);
    if (!valor) return;
    setClientes(null);
    carregar(async () => {
      try {
        setClientes(exigirSucesso(await cobrarAtrasadosAction(true)).clientes ?? []);
      } catch (e) {
        erroToast(e, "Falha ao listar os atrasados.");
        setAberto(false);
      }
    });
  }
  function confirmar() {
    gerar(async () => {
      try {
        const n = exigirSucesso(await cobrarAtrasadosAction(false)).clientes?.length ?? 0;
        toast.success(`${n} ${n === 1 ? "cobrança gerada" : "cobranças geradas"} para aprovação`, { description: "Confira cada uma em “Aguardando aprovação” antes de enviar." });
        setAberto(false);
        router.push("/financeiro/cobranca");
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao gerar as cobranças.");
      }
    });
  }

  const total = (clientes ?? []).reduce((s, c) => s + c.total, 0);
  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger
        render={<Button variant="secondary" disabled={!dataCorte} title={dataCorte ? undefined : "Defina a data de corte na aba Configuração."} />}
      >
        <MdWarning className="size-[18px]" />
        Cobrar atrasados
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Cobrar atrasados fora da régua</DialogTitle>
          <DialogDescription>
            Parcelas com vencimento a partir de {dataCorte ? formatarDataCurta(dataCorte) : "—"} (data de corte) e mais de {limiteDias} dias de atraso, que a régua já não alcança. Cada
            parcela recebe esta cobrança uma única vez; os e-mails vão para “Aguardando aprovação”.
          </DialogDescription>
        </DialogHeader>
        {carregando || !clientes ? (
          <p className="py-8 text-center text-sm text-gray3">Buscando os atrasados…</p>
        ) : clientes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray3">Nenhum cliente atrasado fora da régua desde a data de corte.</p>
        ) : (
          <>
            <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
              {clientes.map((c) => (
                <div key={c.contatoId} className="flex items-center gap-3 rounded-lg border border-gray5 px-3 py-2 text-sm">
                  <span className="flex-1 font-bold text-darkPurple1">{c.cliente}</span>
                  <span className="text-xs text-gray3">
                    {c.parcelas} {c.parcelas === 1 ? "parcela" : "parcelas"} · {c.maiorAtraso} dias
                  </span>
                  <span className="font-semibold text-darkPurple1">{formatarMoeda(c.total)}</span>
                </div>
              ))}
            </div>
            <p className="text-right text-sm">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} · total <span className="font-bold text-darkPurple1">{formatarMoeda(total)}</span>
            </p>
            <p className="rounded-lg border border-orange/40 bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
              Antes de enviar, confira se essas parcelas não foram pagas sem a baixa no Bling — cada envio ainda passa pela aprovação e pela conferência no Bling.
            </p>
          </>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={gerando || carregando || !clientes?.length} onClick={confirmar}>
            {gerando ? "Gerando…" : `Gerar ${clientes?.length ?? 0} ${clientes?.length === 1 ? "cobrança" : "cobranças"} para aprovação`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviaEnvio({ envioId, emailTeste }: { envioId: string; emailTeste: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<{ assunto?: string; html?: string; destinatarios?: string[] } | null>(null);
  const [pendente, iniciar] = useTransition();
  function abrir(valor: boolean) {
    setAberto(valor);
    if (valor && !previa)
      iniciar(async () => {
        try {
          setPrevia(exigirSucesso(await previaEnvioCobranca(envioId)));
        } catch (e) {
          erroToast(e, "Falha ao montar a prévia.");
        }
      });
  }
  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger render={<Button type="button" variant="white" size="sm" />}>
        <MdVisibility className="size-4" />
        Ver e-mail
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{previa?.assunto ?? "Prévia do e-mail"}</DialogTitle>
          <DialogDescription>
            {emailTeste ? `Teste: vai só para ${emailTeste} · destinatários reais: ${previa?.destinatarios?.join(", ") || "—"}` : `Para: ${previa?.destinatarios?.join(", ") || "—"}`}
          </DialogDescription>
        </DialogHeader>
        {pendente || !previa?.html ? (
          <p className="py-10 text-center text-sm text-gray3">Montando a prévia…</p>
        ) : (
          <iframe title="Prévia do e-mail" srcDoc={previa.html} className="h-[60vh] w-full rounded-lg border border-gray5 bg-white" />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Envios aguardando aprovação (pendentes) e com erro (para tentar de novo). */
export function ListaAguardando({ envios, modo, emailTeste }: { envios: EnvioTela[]; modo: ModoCobranca; emailTeste: string | null }) {
  const pendentes = envios.filter((e) => e.status === "pendente");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(pendentes.map((e) => e.id)));
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  // Envios aguardando a confirmação no modal (nada sai sem ela).
  const [aConfirmar, setAConfirmar] = useState<string[] | null>(null);

  function enviar(ids: string[]) {
    setAConfirmar(null);
    iniciar(async () => {
      try {
        const r = exigirSucesso(await enviarEnviosAprovados(ids));
        toast.success(`${r.enviados ?? 0} ${r.enviados === 1 ? "e-mail enviado" : "e-mails enviados"}`, {
          description: [r.cancelados && `${r.cancelados} cancelado(s): parcelas já pagas`, r.falhas && `${r.falhas} com falha — veja o motivo na lista`].filter(Boolean).join(" · ") || undefined,
        });
        setSelecionados(new Set());
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao enviar.");
      }
    });
  }
  function descartar(id: string) {
    iniciar(async () => {
      try {
        exigirSucesso(await descartarEnvio(id));
        toast.success("Envio descartado.");
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao descartar.");
      }
    });
  }
  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      {pendentes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray5 bg-surface px-5 py-3.5">
          <Checkbox
            checked={selecionados.size === pendentes.length}
            onCheckedChange={(v) => setSelecionados(v ? new Set(pendentes.map((e) => e.id)) : new Set())}
            aria-label="Selecionar todos"
          />
          <span className="flex-1 text-sm text-gray">
            {selecionados.size} de {pendentes.length} selecionados
            {modo === "automatico" && " · a régua está no automático: estes ficaram de antes da troca de modo"}
          </span>
          <Button disabled={pendente || selecionados.size === 0} onClick={() => setAConfirmar([...selecionados])}>
            <MdSend className="size-[18px]" />
            {pendente ? "Enviando…" : "Aprovar e enviar"}
          </Button>
        </div>
      )}
      {envios.map((e) => (
        <div key={e.id} className={cn("flex flex-col gap-3 rounded-xl border bg-surface p-5 shadow-card", e.status === "erro" ? "border-red/30" : "border-gray5")}>
          <div className="flex flex-wrap items-center gap-3">
            {e.status === "pendente" && <Checkbox checked={selecionados.has(e.id)} onCheckedChange={() => alternar(e.id)} aria-label={`Selecionar ${e.cliente}`} />}
            <span className="text-base font-bold text-darkPurple1">{e.cliente}</span>
            <StatusPill tom={TOM_TIPO_ENVIO[e.tipo]}>{ROTULO_TIPO_ENVIO[e.tipo]}</StatusPill>
            {e.teste && <StatusPill tom="pending">Teste</StatusPill>}
            <span className="text-sm text-gray3">previsto para {formatarDataCurta(e.data_prevista)}</span>
            <span className="ml-auto text-base font-bold text-darkPurple1">{formatarMoeda(e.total)}</span>
          </div>
          {e.status === "erro" && <p className="rounded-lg bg-dangerBg px-3 py-2 text-sm font-semibold text-red">{e.erro}</p>}
          <div className="flex flex-col gap-1 text-sm">
            {e.itens.map((i) => (
              <div key={`${i.parcela_id}:${i.etapa}`} className="flex flex-wrap gap-x-3 text-gray2">
                <span className="font-semibold text-darkPurple1">{i.rotulo}</span>
                <span>vence {formatarDataCurta(i.vencimento)}</span>
                <span className="text-gray3">{i.etapa >= 1000 ? "escalonamento" : i.etapa === 500 ? "fora da régua" : rotuloEtapa(i.etapa)}</span>
                <span className="ml-auto">{formatarMoeda(Number(i.valor))}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-gray5 pt-3">
            <span className="flex-1 text-xs text-gray3">
              {emailTeste && e.tipo !== "escalonamento" ? (
                <>
                  <span className="font-semibold text-[#ce9232]">Teste: vai só para {emailTeste}</span> · destinatários reais: {e.destinatarios.join(", ") || "nenhum"}
                </>
              ) : (
                <>Para: {e.destinatarios.join(", ") || "sem destinatário"}</>
              )}
            </span>
            <PreviaEnvio envioId={e.id} emailTeste={e.tipo !== "escalonamento" ? emailTeste : null} />
            <Button variant="white" size="sm" disabled={pendente} onClick={() => descartar(e.id)}>
              <MdDelete className="size-4" />
              Descartar
            </Button>
            {e.status === "erro" && (
              <Button size="sm" disabled={pendente} onClick={() => setAConfirmar([e.id])}>
                <MdRefresh className="size-4" />
                Tentar de novo
              </Button>
            )}
          </div>
        </div>
      ))}
      <ConfirmarEnvio envios={envios.filter((e) => aConfirmar?.includes(e.id))} emailTeste={emailTeste} aberto={aConfirmar !== null} onCancelar={() => setAConfirmar(null)} onConfirmar={() => aConfirmar && enviar(aConfirmar)} />
    </div>
  );
}

/** Confirmação antes de qualquer envio: quantos e-mails, para quem e se é teste ou real. */
function ConfirmarEnvio({
  envios,
  emailTeste,
  aberto,
  onCancelar,
  onConfirmar,
}: {
  envios: EnvioTela[];
  emailTeste: string | null;
  aberto: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const aClientes = envios.filter((e) => e.tipo !== "escalonamento");
  const real = aClientes.length > 0 && !emailTeste;
  const total = envios.reduce((s, e) => s + e.total, 0);
  const destino = (e: EnvioTela) => (e.tipo !== "escalonamento" && emailTeste ? `só ${emailTeste} (teste)` : e.destinatarios.join(", ") || "sem destinatário");
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            Enviar {envios.length} {envios.length === 1 ? "e-mail" : "e-mails"}?
          </DialogTitle>
          <DialogDescription>Confira os destinatários antes de confirmar. Parcelas pagas desde a geração são retiradas na hora do envio.</DialogDescription>
        </DialogHeader>
        {real ? (
          <p className="rounded-lg border border-red/30 bg-dangerBg px-3 py-2.5 text-sm font-semibold text-red">
            Envio real: {aClientes.length === 1 ? "o cliente abaixo vai" : `os ${aClientes.length} clientes abaixo vão`} receber a cobrança por e-mail. Não dá para desfazer.
          </p>
        ) : emailTeste && aClientes.length > 0 ? (
          <p className="rounded-lg border border-orange/40 bg-orange3 px-3 py-2.5 text-sm font-semibold text-[#ce9232]">Modo de teste: nenhum cliente recebe — os e-mails vão só para {emailTeste}.</p>
        ) : null}
        <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
          {envios.map((e) => (
            <div key={e.id} className="flex flex-col gap-0.5 rounded-lg border border-gray5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-bold text-darkPurple1">{e.cliente}</span>
                <span className="text-xs text-gray3">{ROTULO_TIPO_ENVIO[e.tipo]}</span>
                <span className="text-sm font-semibold text-darkPurple1">{formatarMoeda(e.total)}</span>
              </div>
              <span className="text-xs break-all text-gray2">Para: {destino(e)}</span>
            </div>
          ))}
        </div>
        {envios.length > 1 && (
          <p className="text-right text-sm">
            Total: <span className="font-bold text-darkPurple1">{formatarMoeda(total)}</span>
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" variant={real ? "destructive" : "default"} onClick={onConfirmar}>
            <MdSend className="size-[18px]" />
            {real ? "Enviar aos clientes" : "Confirmar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Regras da régua para um cliente: pausa, régua própria, destinatários extras. */
export function DialogRegraCliente({ cliente, reguaPadrao }: { cliente: ClienteCobranca; reguaPadrao: number[] }) {
  const r = cliente.regra;
  const [aberto, setAberto] = useState(false);
  const [pausada, setPausada] = useState(r?.pausada ?? false);
  const [motivo, setMotivo] = useState(r?.motivo_pausa ?? "");
  const [regua, setRegua] = useState(r?.regua_dias?.join(", ") ?? "");
  const [extras, setExtras] = useState(r?.destinatarios_extra.join(", ") ?? "");
  const [emails, setEmails] = useState(cliente.emails);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function salvar() {
    iniciar(async () => {
      try {
        exigirSucesso(await salvarRegraCliente({ contatoId: cliente.contatoId, pausada, motivoPausa: motivo, regua, destinatariosExtra: extras }));
        toast.success("Regras do cliente salvas.");
        setAberto(false);
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao salvar.");
      }
    });
  }
  function relerEmails() {
    iniciar(async () => {
      try {
        const r = exigirSucesso(await atualizarEmailsDoCliente(cliente.contatoId));
        setEmails(r.emails ?? []);
        toast.success(r.origem === "pedido" ? "E-mails relidos das observações dos pedidos." : "Pedido sem e-mail nas observações: valem os e-mails do cadastro do contato.");
      } catch (e) {
        erroToast(e, "Falha ao ler os e-mails no Bling.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="white" size="sm" />}>
        <MdEdit className="size-4" />
        Regras
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{cliente.nome}</DialogTitle>
          <DialogDescription>Regras da régua de cobrança só para este cliente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label variante="campo">Destinatários {cliente.origemEmails === "pedido" ? "(observações internas do pedido)" : "(cadastro do contato no Bling)"}</Label>
            <p className="text-sm text-gray2">{emails.length ? emails.join(", ") : "Nenhum e-mail encontrado no Bling."}</p>
            <p className="text-xs text-gray3">
              Prioridade: os e-mails anotados nas observações internas do pedido de venda no Bling. Sem nenhum, valem o e-mail e o e-mail de nota fiscal do cadastro do contato.
            </p>
            <Button type="button" variant="white" size="sm" className="self-start" disabled={pendente} onClick={relerEmails}>
              <MdMarkEmailRead className="size-4" />
              Reler e-mails do Bling
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label variante="campo">Destinatários extras</Label>
            <Input value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="financeiro@cliente.com, outro@cliente.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label variante="campo">Régua própria (dias em relação ao vencimento)</Label>
            <Input value={regua} onChange={(e) => setRegua(e.target.value)} placeholder={`Padrão: ${reguaPadrao.map(rotuloEtapa).join(", ")}`} />
          </div>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-darkPurple1">
            <Checkbox checked={pausada} onCheckedChange={(v) => setPausada(!!v)} />
            Pausar a régua para este cliente (ex.: em negociação)
          </label>
          {pausada && <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da pausa" rows={2} />}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pendente} onClick={salvar}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_MODO: Record<ModoCobranca, string> = { desligado: "Desligada", aprovacao: "Com aprovação", automatico: "Automática" };

export function FormConfiguracaoCobranca({ config }: { config: CobrancaConfiguracaoRow }) {
  const [modo, setModo] = useState<ModoCobranca>(config.modo);
  const [regua, setRegua] = useState(config.regua_dias.join(", "));
  const [escalonamento, setEscalonamento] = useState(String(config.escalonamento_dias));
  const [dataCorte, setDataCorte] = useState(config.data_corte ?? "");
  const [remetenteNome, setRemetenteNome] = useState(config.remetente_nome);
  const [remetenteEmail, setRemetenteEmail] = useState(config.remetente_email ?? "");
  const [responderPara, setResponderPara] = useState(config.responder_para.join(", "));
  const [emailsEscalonamento, setEmailsEscalonamento] = useState(config.emails_escalonamento.join(", "));
  const [chavePix, setChavePix] = useState(config.chave_pix ?? "");
  const [emailTeste, setEmailTeste] = useState(config.email_teste ?? "");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function salvar() {
    iniciar(async () => {
      try {
        exigirSucesso(
          await salvarConfiguracaoCobranca({
            modo,
            regua,
            escalonamentoDias: Number(escalonamento),
            dataCorte: dataCorte || null,
            remetenteNome,
            remetenteEmail,
            responderPara,
            emailsEscalonamento,
            chavePix,
            emailTeste,
          }),
        );
        toast.success("Configuração da régua salva.");
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao salvar.");
      }
    });
  }

  const campo = "flex flex-col gap-2";
  return (
    <CardModulo icone={MdTune} cor="bg-iconGray" titulo="Configuração da régua">
      <div className="flex flex-col gap-5">
        <div className={campo}>
          <Label variante="campo">Funcionamento</Label>
          <SegmentedToggle opcoes={(Object.keys(ROTULO_MODO) as ModoCobranca[]).map((v) => ({ valor: v, rotulo: ROTULO_MODO[v] }))} valor={modo} onChange={setModo} />
          <p className="text-xs text-gray3">
            Com aprovação: os e-mails do dia esperam a aprovação nesta tela. Automática: saem direto às 9h. O aviso interno de escalonamento sai sempre que a régua está ligada.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <div className={campo}>
            <Label variante="campo">Régua padrão (dias)</Label>
            <Input value={regua} onChange={(e) => setRegua(e.target.value)} placeholder="-3, 0, 3, 7, 12" />
          </div>
          <div className={campo}>
            <Label variante="campo">Escalonamento (dias de atraso)</Label>
            <Input inputMode="numeric" value={escalonamento} onChange={(e) => setEscalonamento(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className={campo}>
            <Label variante="campo">Data de corte</Label>
            <Input type="date" value={dataCorte} onChange={(e) => setDataCorte(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray3">
          Dias em relação ao vencimento: negativo é antes (−3 = três dias antes), 0 é o dia do vencimento. Só entram parcelas com vencimento a partir da data de corte.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <div className={campo}>
            <Label variante="campo">Nome do remetente</Label>
            <Input value={remetenteNome} onChange={(e) => setRemetenteNome(e.target.value)} />
          </div>
          <div className={campo}>
            <Label variante="campo">E-mail do remetente</Label>
            <Input value={remetenteEmail} onChange={(e) => setRemetenteEmail(e.target.value)} placeholder="Padrão: o remetente do sistema" />
          </div>
          <div className={campo}>
            <Label variante="campo">Respostas vão para</Label>
            <Input value={responderPara} onChange={(e) => setResponderPara(e.target.value)} placeholder="financeiro@footure.com.br" />
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <div className={campo}>
            <Label variante="campo">Avisos de escalonamento para</Label>
            <Input value={emailsEscalonamento} onChange={(e) => setEmailsEscalonamento(e.target.value)} placeholder="e-mails da equipe, separados por vírgula" />
          </div>
          <div className={campo}>
            <Label variante="campo">Chave Pix nos e-mails (opcional)</Label>
            <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="Sem chave: o e-mail não mostra Pix" />
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray3">O e-mail do remetente precisa ser de um domínio verificado no Resend (footure.com.br).</p>
        <div className={cn(campo, "rounded-lg border border-orange/40 bg-orange3/50 p-4")}>
          <Label variante="campo">Modo de teste: enviar tudo para</Label>
          <Input value={emailTeste} onChange={(e) => setEmailTeste(e.target.value)} placeholder="Vazio = e-mails vão para os clientes" />
          <p className="text-xs text-gray2">
            Preenchido, nenhum cliente recebe nada: cada e-mail da régua vai só para este endereço, com o assunto marcado [TESTE] e os destinatários reais indicados. Use durante a homologação. Ao
            esvaziar este campo, os envios feitos em teste são apagados, para não contarem como enviados.
          </p>
        </div>
        <Button className="self-end" disabled={pendente} onClick={salvar}>
          {pendente ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </CardModulo>
  );
}

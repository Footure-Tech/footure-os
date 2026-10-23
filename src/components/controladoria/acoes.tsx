"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdAccountBalance, MdMarkEmailRead, MdPersonAdd, MdRefresh, MdReplay, MdSchedule, MdTaskAlt, MdTune } from "react-icons/md";
import { exigirSucesso } from "@/lib/resultadoAcao";
import type { CamadaContaFinanceira, FinPremissasRow, StatusAlerta } from "@/lib/supabase/database.types";
import { ROTULO_CAMADA } from "@/lib/controladoria/modelo";
import {
  agirSobreAlerta,
  atualizarDadosControladoria,
  enviarResumoAgora,
  salvarCamadaConta,
  salvarPremissasControladoria,
  salvarSaldosControladoria,
} from "@/lib/controladoria/serverActions";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardModulo } from "@/components/negocio/card-modulo";

function erroToast(erro: unknown, padrao: string) {
  toast.error(erro instanceof Error ? erro.message : padrao);
}

/** Roda a sincronização financeira + alertas agora (a mesma rotina do cron, sem o e-mail). */
export function BotaoAtualizarDados() {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={pendente}
      title="Lê contas a pagar e a receber, categorias e contas do Bling e reavalia os alertas (leva de 1 a 4 minutos)."
      onClick={() =>
        iniciar(async () => {
          try {
            const { resumo } = exigirSucesso(await atualizarDadosControladoria());
            if (resumo?.erro) toast.error("A sincronização com o Bling falhou; os alertas foram reavaliados com os dados anteriores.", { description: resumo.erro });
            else
              toast.success("Dados atualizados.", {
                description: [
                  `${resumo?.detalhados ?? 0} lançamentos detalhados`,
                  resumo?.pendentes ? `${resumo.pendentes} ainda pendentes (rode de novo)` : null,
                  resumo?.alertasNovos ? `${resumo.alertasNovos} alerta(s) novo(s)` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              });
            router.refresh();
          } catch (e) {
            erroToast(e, "Falha ao atualizar.");
          }
        })
      }
    >
      <MdRefresh className="size-[18px]" />
      {pendente ? "Atualizando…" : "Atualizar dados do Bling"}
    </Button>
  );
}

type ModoAcao = "atribuir" | "adiar" | "encerrar";
const NINGUEM = "ninguem";

export function AcoesAlerta({
  alerta,
  pessoas,
  hoje,
}: {
  alerta: { id: string; titulo: string; status: StatusAlerta; responsavel_id: string | null };
  pessoas: { id: string; nome: string }[];
  hoje: string;
}) {
  const [modo, setModo] = useState<ModoAcao | null>(null);
  const [responsavel, setResponsavel] = useState(alerta.responsavel_id ?? NINGUEM);
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function abrir(m: ModoAcao) {
    setModo(m);
    setMotivo("");
    setAte("");
    setResponsavel(alerta.responsavel_id ?? NINGUEM);
  }
  function executarAcao(dados: Parameters<typeof agirSobreAlerta>[0], sucesso: string) {
    iniciar(async () => {
      try {
        exigirSucesso(await agirSobreAlerta(dados));
        toast.success(sucesso);
        setModo(null);
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao registrar a ação.");
      }
    });
  }
  function confirmar() {
    if (modo === "atribuir") executarAcao({ acao: "atribuir", alertaId: alerta.id, responsavelId: responsavel === NINGUEM ? null : responsavel }, "Responsável registrado.");
    if (modo === "adiar") executarAcao({ acao: "adiar", alertaId: alerta.id, ate, motivo }, "Alerta adiado.");
    if (modo === "encerrar") executarAcao({ acao: "encerrar", alertaId: alerta.id, motivo }, "Alerta encerrado.");
  }

  const fechado = alerta.status === "encerrado" || alerta.status === "adiado";
  const itensPessoas = Object.fromEntries([[NINGUEM, "Ninguém"], ...pessoas.map((p) => [p.id, p.nome])]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {alerta.status === "resolvido" ? null : fechado ? (
        <Button size="sm" variant="white" disabled={pendente} onClick={() => executarAcao({ acao: "reabrir", alertaId: alerta.id }, "Alerta reaberto.")}>
          <MdReplay className="size-4" />
          Reabrir
        </Button>
      ) : (
        <>
          <Button size="sm" variant="white" onClick={() => abrir("atribuir")}>
            <MdPersonAdd className="size-4" />
            {alerta.responsavel_id ? "Trocar responsável" : "Atribuir"}
          </Button>
          <Button size="sm" variant="white" onClick={() => abrir("adiar")}>
            <MdSchedule className="size-4" />
            Adiar
          </Button>
          <Button size="sm" variant="white" onClick={() => abrir("encerrar")}>
            <MdTaskAlt className="size-4" />
            Encerrar
          </Button>
        </>
      )}
      <Dialog open={modo !== null} onOpenChange={(v) => !v && setModo(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{modo === "atribuir" ? "Atribuir responsável" : modo === "adiar" ? "Adiar alerta" : "Encerrar alerta"}</DialogTitle>
            <DialogDescription>{alerta.titulo}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {modo === "atribuir" && (
              <div className="flex flex-col gap-2">
                <Label variante="campo">Responsável</Label>
                <Select items={itensPessoas} value={responsavel} onValueChange={(v) => setResponsavel(v ?? NINGUEM)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha quem cuida" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUEM}>Ninguém</SelectItem>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {modo === "adiar" && (
              <div className="flex flex-col gap-2">
                <Label variante="campo">Volta para a fila em</Label>
                <Input type="date" min={hoje} value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
            )}
            {(modo === "adiar" || modo === "encerrar") && (
              <div className="flex flex-col gap-2">
                <Label variante="campo">{modo === "adiar" ? "Por que adiar" : "O que foi feito (ou por que não se aplica)"}</Label>
                <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                {modo === "encerrar" && (
                  <p className="text-xs text-gray3">O alerta fica encerrado enquanto a condição persistir. Se ela sumir e voltar a ocorrer, ele reabre sozinho.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
            <Button type="button" disabled={pendente || (modo === "adiar" && !ate) || (modo !== "atribuir" && motivo.trim().length < 3)} onClick={confirmar}>
              {pendente ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Texto do campo de moeda → número (aceita "12.345,67", "12345.67" e negativo). */
function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!limpo.trim()) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

export function FormSaldos({
  contas,
  hoje,
}: {
  contas: { id: number; descricao: string; camada: CamadaContaFinanceira; saldo_informado: number | null; saldo_informado_em: string | null }[];
  hoje: string;
}) {
  const [data, setData] = useState(hoje);
  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(contas.map((c) => [c.id, c.saldo_informado === null ? "" : String(c.saldo_informado).replace(".", ",")])),
  );
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function salvar() {
    const saldos = contas.map((c) => ({ id: c.id, saldo: lerValor(valores[c.id] ?? "") }));
    if (saldos.some((s) => Number.isNaN(s.saldo))) {
      toast.error("Há um saldo com valor inválido.");
      return;
    }
    iniciar(async () => {
      try {
        exigirSucesso(await salvarSaldosControladoria({ data, saldos }));
        toast.success("Saldos salvos. A projeção de caixa parte deles.");
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao salvar os saldos.");
      }
    });
  }

  return (
    <CardModulo icone={MdAccountBalance} cor="bg-iconGreen" titulo="Saldos das contas">
      <p className="text-sm text-gray2">
        As contas da Footure no Bling são manuais (sem extrato automático). Informe o saldo de cada conta no mesmo dia, conferindo o extrato do banco ou do gateway. Deixe em branco a
        conta que não quer considerar.
      </p>
      <div className="flex max-w-[220px] flex-col gap-2">
        <Label variante="campo">Saldos do dia</Label>
        <Input type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="flex flex-col divide-y divide-gray5 rounded-lg border border-gray5">
        {contas.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[220px] flex-1">
              <span className="block text-sm font-bold text-darkPurple1">{c.descricao}</span>
              <span className="text-xs text-gray3">
                {ROTULO_CAMADA[c.camada]}
                {c.saldo_informado !== null && c.saldo_informado_em ? ` · último: ${formatarMoeda(c.saldo_informado)} em ${formatarDataCurta(c.saldo_informado_em)}` : " · sem saldo informado"}
              </span>
            </div>
            <Input
              className="w-[180px] text-right"
              inputMode="decimal"
              placeholder="0,00"
              value={valores[c.id] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
              aria-label={`Saldo de ${c.descricao}`}
            />
          </div>
        ))}
      </div>
      <div>
        <Button disabled={pendente || !data} onClick={salvar}>
          {pendente ? "Salvando…" : "Salvar saldos"}
        </Button>
      </div>
    </CardModulo>
  );
}

export function SeletorCamada({ id, camada }: { id: number; camada: CamadaContaFinanceira }) {
  const [valor, setValor] = useState(camada);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Select
      items={ROTULO_CAMADA}
      value={valor}
      disabled={pendente}
      onValueChange={(v) => {
        if (!v) return;
        const nova = v as CamadaContaFinanceira;
        setValor(nova);
        iniciar(async () => {
          try {
            exigirSucesso(await salvarCamadaConta({ id, camada: nova }));
            router.refresh();
          } catch (e) {
            setValor(camada);
            erroToast(e, "Falha ao salvar a camada.");
          }
        });
      }}
    >
      <SelectTrigger className="w-[210px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROTULO_CAMADA) as CamadaContaFinanceira[]).map((k) => (
          <SelectItem key={k} value={k}>
            {ROTULO_CAMADA[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FormPremissas({ premissas }: { premissas: FinPremissasRow }) {
  const [v, setV] = useState({
    colchaoMeses: String(premissas.colchao_meses),
    runwayAlertaMeses: String(premissas.runway_alerta_meses),
    diasConciliacao: String(premissas.dias_conciliacao),
    excedenteMeses: String(premissas.excedente_meses),
    despesaSubiuPct: String(premissas.despesa_subiu_pct),
    fornecedorNovoValor: String(premissas.fornecedor_novo_valor),
    duplicidadeDias: String(premissas.duplicidade_dias),
    receberAntigoDias: String(premissas.receber_antigo_dias),
    cobrancaAntecedenciaDias: String(premissas.cobranca_antecedencia_dias),
  });
  const [resumoAtivo, setResumoAtivo] = useState(premissas.resumo_diario_ativo);
  const [pendente, iniciar] = useTransition();
  const [enviando, enviar] = useTransition();
  const router = useRouter();
  const num = (s: string) => Number(s.replace(",", "."));

  function salvar() {
    iniciar(async () => {
      try {
        exigirSucesso(
          await salvarPremissasControladoria({
            colchaoMeses: num(v.colchaoMeses),
            runwayAlertaMeses: num(v.runwayAlertaMeses),
            diasConciliacao: num(v.diasConciliacao),
            excedenteMeses: num(v.excedenteMeses),
            despesaSubiuPct: num(v.despesaSubiuPct),
            fornecedorNovoValor: num(v.fornecedorNovoValor),
            duplicidadeDias: num(v.duplicidadeDias),
            receberAntigoDias: num(v.receberAntigoDias),
            cobrancaAntecedenciaDias: num(v.cobrancaAntecedenciaDias),
            resumoDiarioAtivo: resumoAtivo,
          }),
        );
        toast.success("Premissas salvas e alertas reavaliados.");
        router.refresh();
      } catch (e) {
        erroToast(e, "Falha ao salvar as premissas.");
      }
    });
  }

  const campos: { chave: keyof typeof v; rotulo: string; ajuda: string }[] = [
    { chave: "colchaoMeses", rotulo: "Colchão mínimo (meses de saídas)", ajuda: "Caixa disponível que não deve ser furado." },
    { chave: "runwayAlertaMeses", rotulo: "Alerta de runway abaixo de (meses)", ajuda: "Caixa total ÷ queima média." },
    { chave: "diasConciliacao", rotulo: "Saldo velho depois de (dias)", ajuda: "Pede a atualização dos saldos." },
    { chave: "excedenteMeses", rotulo: "Excedente acima de (meses de saídas)", ajuda: "Sugere aplicar o que passar disso." },
    { chave: "despesaSubiuPct", rotulo: "Despesa subiu acima de (%)", ajuda: "Último mês contra a média de 3." },
    { chave: "fornecedorNovoValor", rotulo: "Fornecedor novo a partir de (R$)", ajuda: "Pede confirmação da despesa." },
    { chave: "duplicidadeDias", rotulo: "Duplicidade: vencimentos em até (dias)", ajuda: "Mesmo fornecedor e valor." },
    { chave: "receberAntigoDias", rotulo: "Recebível antigo após (dias)", ajuda: "Pede o saneamento da carteira." },
    { chave: "cobrancaAntecedenciaDias", rotulo: "Cobrança sem boleto/Pix em até (dias)", ajuda: "Antes do vencimento." },
  ];

  return (
    <CardModulo icone={MdTune} cor="bg-iconGray" titulo="Premissas dos alertas">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {campos.map((c) => (
          <div key={c.chave} className="flex flex-col gap-1.5">
            <Label variante="campo">{c.rotulo}</Label>
            <Input inputMode="decimal" value={v[c.chave]} onChange={(e) => setV((x) => ({ ...x, [c.chave]: e.target.value }))} />
            <span className="text-xs text-gray3">{c.ajuda}</span>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2.5 text-sm font-semibold text-darkPurple1">
        <Checkbox checked={resumoAtivo} onCheckedChange={(x) => setResumoAtivo(!!x)} />
        Enviar o resumo diário por e-mail à Diretoria (5h, só quando há o que reportar)
      </label>
      <div className="flex flex-wrap gap-2.5">
        <Button disabled={pendente} onClick={salvar}>
          {pendente ? "Salvando…" : "Salvar premissas"}
        </Button>
        <Button
          variant="white"
          disabled={enviando}
          onClick={() =>
            enviar(async () => {
              try {
                const r = exigirSucesso(await enviarResumoAgora());
                if (r.destinatarios) toast.success(`Resumo enviado para ${r.destinatarios} ${r.destinatarios === 1 ? "pessoa" : "pessoas"} da Diretoria.`);
                else toast.info(r.motivo ?? "Resumo não enviado.");
              } catch (e) {
                erroToast(e, "Falha ao enviar o resumo.");
              }
            })
          }
        >
          <MdMarkEmailRead className="size-4" />
          {enviando ? "Enviando…" : "Enviar o resumo de hoje agora"}
        </Button>
      </div>
    </CardModulo>
  );
}

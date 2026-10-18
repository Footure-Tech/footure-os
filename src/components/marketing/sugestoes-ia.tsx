"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdArrowBack, MdAutoAwesome, MdChevronRight, MdWarningAmber } from "react-icons/md";
import type { RodadaSugestoes } from "@/lib/marketing/sugestoesIa";
import { gerarSugestoesIaAction } from "@/lib/marketing/serverActions";
import { exigirSucesso } from "@/lib/resultadoAcao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { GerandoSugestoes } from "@/components/marketing/gerando-sugestoes";

const DIAS_CONFIRMAR = 7;
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const data = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const milhares = (n: number) => (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";

type Consumo = { mes: number; total: number; rodadas: number };
type Visao = { tipo: "lista" } | { tipo: "detalhe"; id: string; nova?: boolean } | { tipo: "confirmar" } | { tipo: "gerando" };

// "Sugestões por IA" do detalhe da campanha: modal com o histórico de rodadas,
// o detalhe de cada uma e o botão de gerar (com confirmação se a última tem
// menos de 7 dias). Ao final, o custo da rodada e o consumo das sugestões.
export function SugestoesIa({
  chave,
  periodo,
  rodadas,
  recenteId,
  consumo,
}: {
  chave: string;
  periodo: "30d" | "90d";
  rodadas: RodadaSugestoes[];
  /** Rodada com menos de 7 dias (calculado no servidor): gerar outra pede confirmação. */
  recenteId: string | null;
  consumo: Consumo;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [visao, setVisao] = useState<Visao>({ tipo: "lista" });
  const [, iniciar] = useTransition();
  const gerando = visao.tipo === "gerando";
  const recente = rodadas.find((r) => r.id === recenteId) ?? null;

  function gerar() {
    setVisao({ tipo: "gerando" });
    iniciar(async () => {
      try {
        const { id } = exigirSucesso(await gerarSugestoesIaAction(chave, periodo));
        router.refresh();
        setVisao(id ? { tipo: "detalhe", id, nova: true } : { tipo: "lista" });
      } catch (erro) {
        toast.error("Não foi possível gerar as sugestões", { description: erro instanceof Error ? erro.message : undefined });
        setVisao({ tipo: "lista" });
      }
    });
  }

  const rodada = visao.tipo === "detalhe" ? rodadas.find((r) => r.id === visao.id) : undefined;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (gerando && !v) return;
        setAberto(v);
        if (v) setVisao({ tipo: "lista" });
      }}
    >
      <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
        <MdAutoAwesome className="size-4" />
        Sugestões por IA
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl" showCloseButton={!gerando}>
        <DialogHeader>
          <DialogTitle>Sugestões por IA</DialogTitle>
          <DialogDescription>Interpretação e ideias geradas pelo Claude a partir dos números e das imagens da campanha — para validação humana; as regras continuam sendo a base da decisão.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {visao.tipo === "gerando" && <GerandoSugestoes />}

          {visao.tipo === "confirmar" && recente && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <MdWarningAmber className="size-10 text-orange2" />
              <p className="max-w-md text-sm text-gray2">
                Já existe uma rodada de sugestões de <strong className="font-bold text-darkPurple1">{quando(recente.criadoEm)}</strong> (menos de {DIAS_CONFIRMAR} dias). Gerar outra consome tokens
                da Anthropic — a última custou {usd(recente.custoUsd)}.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="white" onClick={() => setVisao({ tipo: "lista" })}>
                  Cancelar
                </Button>
                <Button type="button" onClick={gerar}>
                  <MdAutoAwesome className="size-4" />
                  Gerar mesmo assim
                </Button>
              </div>
            </div>
          )}

          {visao.tipo === "lista" && (
            <div className="flex flex-col gap-3">
              {rodadas.length === 0 ? (
                <EstadoVazio compacto icone={MdAutoAwesome} titulo="Nenhuma sugestão gerada ainda" descricao="Gere a primeira rodada para esta campanha." />
              ) : (
                <ul className="flex flex-col">
                  {rodadas.map((r) => (
                    <li key={r.id} className="border-b border-gray5 last:border-0">
                      <button
                        type="button"
                        onClick={() => setVisao({ tipo: "detalhe", id: r.id })}
                        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lightPurple4 text-purple-text">
                          <MdAutoAwesome className="size-[18px]" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-bold text-darkPurple1">{quando(r.criadoEm)}</span>
                          <span className="truncate text-xs text-gray3">
                            {r.autor ?? "—"} · período {data(r.de)} a {data(r.ate)} · {r.resultado.conceitos.length} conceitos · {usd(r.custoUsd)}
                          </span>
                        </span>
                        <MdChevronRight className="size-[18px] shrink-0 text-gray3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {visao.tipo === "detalhe" && rodada && <DetalheRodada r={rodada} />}
        </div>

        {!gerando && visao.tipo !== "confirmar" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray5 pt-3">
            <div className="flex flex-col text-xs text-gray3">
              {visao.tipo === "detalhe" && rodada && (
                <span className={visao.nova ? "font-semibold text-darkPurple1" : undefined}>
                  {visao.nova ? "Rodada concluída · " : ""}custo {usd(rodada.custoUsd)} ({milhares(rodada.tokensEntrada)} tokens de entrada, {milhares(rodada.tokensSaida)} de saída)
                </span>
              )}
              <span>
                Consumo das sugestões por IA: {usd(consumo.mes)} no mês · {usd(consumo.total)} no total ({consumo.rodadas} {consumo.rodadas === 1 ? "rodada" : "rodadas"})
              </span>
            </div>
            <div className="flex gap-2">
              {visao.tipo === "detalhe" && (
                <Button type="button" variant="white" size="sm" onClick={() => setVisao({ tipo: "lista" })}>
                  <MdArrowBack className="size-4" />
                  Histórico
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => (recente ? setVisao({ tipo: "confirmar" }) : gerar())}>
                <MdAutoAwesome className="size-4" />
                Gerar novas sugestões
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

/** Detalhe de uma rodada: diagnóstico, leitura dos criativos, conceitos, testes e alertas. */
function DetalheRodada({ r }: { r: RodadaSugestoes }) {
  const s = r.resultado;
  return (
    <div className="flex flex-col gap-5 text-sm text-gray2">
      <p className="text-xs text-gray3">
        Gerada em {quando(r.criadoEm)} por {r.autor ?? "—"} · período {data(r.de)} a {data(r.ate)}
        {r.imagens.length > 0 && ` · imagens analisadas: ${r.imagens.length}`}
      </p>
      <Secao titulo="Diagnóstico">
        <p className="leading-relaxed">{s.diagnostico}</p>
      </Secao>
      <Secao titulo="Leitura dos criativos">
        <p className="leading-relaxed">{s.leituraCriativos.resumo}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-green5/60 p-3">
            <span className="text-xs font-bold text-green1">O que funciona</span>
            <ul className="mt-1 list-disc pl-4 text-[13px]">
              {s.leituraCriativos.oQueFunciona.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-dangerBg/60 p-3">
            <span className="text-xs font-bold text-red">O que falta</span>
            <ul className="mt-1 list-disc pl-4 text-[13px]">
              {s.leituraCriativos.oQueFalta.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Secao>
      <Secao titulo="Conceitos de criativo novo">
        <div className="grid gap-3 sm:grid-cols-2">
          {s.conceitos.map((c) => (
            <article key={c.titulo} className="flex flex-col gap-1.5 rounded-lg border border-gray5 p-3 text-[13px]">
              <strong className="text-sm font-bold text-darkPurple1">{c.titulo}</strong>
              <span>
                <b className="font-semibold text-darkPurple1">Gancho:</b> {c.gancho}
              </span>
              <span>
                <b className="font-semibold text-darkPurple1">Mensagem:</b> {c.mensagem}
              </span>
              <span>
                <b className="font-semibold text-darkPurple1">Visual:</b> {c.visual}
              </span>
              <span>
                <b className="font-semibold text-darkPurple1">Chamada:</b> {c.chamada}
              </span>
              <span className="text-xs text-gray3">Baseado em: {c.baseadoEm}</span>
            </article>
          ))}
        </div>
      </Secao>
      <Secao titulo="Hipóteses de teste">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px]">
          {s.testes.map((t) => (
            <li key={t.hipotese}>
              <strong className="font-semibold text-darkPurple1">{t.hipotese}</strong> — {t.como} <span className="text-gray3">Métrica: {t.metrica}</span>
            </li>
          ))}
        </ol>
      </Secao>
      {s.alertas.length > 0 && (
        <Secao titulo="Alertas de dados">
          <ul className="flex flex-col gap-1.5 rounded-lg bg-orange3 p-3 text-[13px] text-[#8a5a12]">
            {s.alertas.map((a) => (
              <li key={a} className="flex gap-2">
                <MdWarningAmber className="mt-0.5 size-4 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}

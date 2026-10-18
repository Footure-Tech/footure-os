"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MdCheckCircle,
  MdContentCopy,
  MdOpenInNew,
  MdRefresh,
  MdRule,
  MdWarningAmber,
  MdCancel,
  MdHourglassEmpty,
} from "react-icons/md";
import type { VerificacaoRastreio } from "@/lib/marketing/verificacaoRastreio";
import {
  iniciarVerificacaoRastreioAction,
  verificarRastreioAction,
} from "@/lib/marketing/serverActions";
import { exigirSucesso } from "@/lib/resultadoAcao";
import { VISUAL_VERIFICACAO } from "@/lib/marketing/rastreio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/ds/status-pill";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function Copiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
        {rotulo}
      </span>
      <div className="flex items-start gap-2 rounded-lg border border-gray5 p-2">
        <code className="min-w-0 flex-1 font-mono text-[12px] break-all text-darkPurple1">
          {valor}
        </code>
        <Button
          type="button"
          variant="white"
          size="xs"
          onClick={() =>
            navigator.clipboard
              .writeText(valor)
              .then(() => toast.success(`${rotulo} copiado`))
          }
        >
          <MdContentCopy className="size-3.5" />
          Copiar
        </Button>
      </div>
    </div>
  );
}

// Verificação de ponta a ponta do rastreio da campanha: link de teste com
// código, preenchimento manual do formulário e conferência do lead no Kommo,
// campo a campo, com o status gravado e as instruções de correção.
export function VerificacaoPontaAPonta({
  chave,
  verificacoes,
}: {
  chave: string;
  verificacoes: VerificacaoRastreio[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const atual = verificacoes[0] ?? null;

  function novaVerificacao() {
    iniciar(async () => {
      try {
        exigirSucesso(await iniciarVerificacaoRastreioAction(chave));
        router.refresh();
      } catch (erro) {
        toast.error("Não foi possível iniciar a verificação", {
          description: erro instanceof Error ? erro.message : undefined,
        });
      }
    });
  }

  function verificar(v: VerificacaoRastreio) {
    iniciar(async () => {
      try {
        const r = exigirSucesso(await verificarRastreioAction(v.id, chave));
        if (!r.encontrado)
          toast.info("O lead de teste ainda não chegou ao Kommo", {
            description:
              "A integração pode levar alguns minutos. Confira se o nome foi preenchido com o código e tente de novo.",
          });
        router.refresh();
      } catch (erro) {
        toast.error("Não foi possível verificar", {
          description: erro instanceof Error ? erro.message : undefined,
        });
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="secondary" size="sm" />}
      >
        <MdRule className="size-4" />
        Verificar ponta a ponta
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Verificação de ponta a ponta</DialogTitle>
          <DialogDescription>
            Testa a cadeia inteira — anúncio → página → formulário → Make →
            Kommo — com um lead de teste, e mostra em qual etapa o rastreio se
            perde.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-1 text-[13px] text-gray2">
          {!atual ? (
            <p>Nenhuma verificação feita nesta campanha ainda.</p>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tom={VISUAL_VERIFICACAO[atual.status].tom}>
                  {VISUAL_VERIFICACAO[atual.status].rotulo}
                </StatusPill>
                <span className="text-xs text-gray3">
                  iniciada em {quando(atual.criadoEm)} por {atual.autor ?? "—"}
                  {atual.verificadoEm &&
                    ` · verificada em ${quando(atual.verificadoEm)}`}
                  {atual.anuncio && ` · anúncio de teste: ${atual.anuncio}`}
                </span>
              </div>

              {atual.status === "aguardando" && (
                <>
                  <ol className="flex list-decimal flex-col gap-1 pl-5">
                    <li>
                      Abra o <strong>link de teste</strong> numa{" "}
                      <strong>janela anônima</strong> (para não herdar cookies
                      de outras campanhas).
                    </li>
                    <li>
                      Navegue normalmente e preencha o formulário com o nome e o
                      e-mail abaixo (o código identifica o lead).
                    </li>
                    <li>
                      Envie o formulário, aguarde 1–2 minutos e clique em{" "}
                      <strong>Verificar agora</strong>.
                    </li>
                  </ol>
                  <Copiavel rotulo="Link de teste" valor={atual.urlTeste} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Copiavel
                      rotulo="Nome"
                      valor={`Teste Rastreio ${atual.codigo}`}
                    />
                    <Copiavel
                      rotulo="E-mail"
                      valor={`rastreio+${atual.codigo.toLowerCase()}@footure.com.br`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={atual.urlTeste}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-text hover:underline"
                    >
                      <MdOpenInNew className="size-4" /> Abrir o link de teste
                    </a>
                  </div>
                  <Button
                    type="button"
                    onClick={() => verificar(atual)}
                    disabled={pendente}
                    className="self-start"
                  >
                    <MdHourglassEmpty className="size-4" />
                    {pendente ? "Procurando no Kommo…" : "Verificar agora"}
                  </Button>
                </>
              )}

              {atual.resultado && (
                <>
                  <ul className="flex flex-col divide-y divide-gray5 rounded-lg border border-gray5">
                    {atual.resultado.map((c) => (
                      <li key={c.chave} className="flex flex-col gap-1 p-3">
                        <div className="flex items-center gap-2">
                          {c.ok ? (
                            <MdCheckCircle className="size-[18px] shrink-0 text-green1" />
                          ) : c.alerta ? (
                            <MdWarningAmber className="size-[18px] shrink-0 text-orange2" />
                          ) : (
                            <MdCancel className="size-[18px] shrink-0 text-red" />
                          )}
                          <span className="font-semibold text-darkPurple1">
                            {c.rotulo}
                          </span>
                          <span className="ml-auto text-xs text-gray3">
                            esperado {c.esperado} · recebido{" "}
                            {c.recebido ?? "vazio"}
                          </span>
                        </div>
                        {c.correcao && (
                          <p className="pl-[26px] text-xs leading-relaxed text-gray2">
                            {c.correcao}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray3">
                    Lead de teste nº {atual.leadId} no Kommo — marque-o como
                    perdido ou apague para não entrar nos números.
                  </p>
                </>
              )}
            </section>
          )}

          {verificacoes.length > 1 && (
            <section className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
                Verificações anteriores
              </span>
              <ul className="flex flex-col gap-1">
                {verificacoes.slice(1, 6).map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-xs">
                    <StatusPill tom={VISUAL_VERIFICACAO[v.status].tom}>
                      {VISUAL_VERIFICACAO[v.status].rotulo}
                    </StatusPill>
                    <span className="text-gray3">
                      {quando(v.criadoEm)} · {v.autor ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="flex justify-end border-t border-gray5 pt-3">
          <Button
            type="button"
            variant={atual ? "white" : "default"}
            size="sm"
            onClick={novaVerificacao}
            disabled={pendente}
          >
            <MdRefresh className="size-4" />
            {atual ? "Nova verificação" : "Iniciar verificação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

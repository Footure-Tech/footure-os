"use client";

import { toast } from "sonner";
import { MdContentCopy, MdOpenInNew } from "react-icons/md";
import type { ProblemaTag, StatusRastreio } from "@/lib/marketing/rastreio";
import { PARAMETROS_META } from "@/lib/marketing/rastreio";
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

const VISUAL: Record<
  StatusRastreio,
  { rotulo: string; tom: "active" | "pending" | "inactive" }
> = {
  ok: { rotulo: "Rastreio OK", tom: "active" },
  alerta: { rotulo: "Rastreio incompleto", tom: "pending" },
  erro: { rotulo: "Rastreio com problema", tom: "inactive" },
};

// Selo do rastreio do anúncio (parâmetros de URL lidos da Meta) e, se houver
// problema, o "Como corrigir" com o texto certo para colar.
export function RastreioAnuncio({
  status,
  problemas,
  urlTags,
  adId,
  accountId,
  nome,
}: {
  status: StatusRastreio;
  problemas: ProblemaTag[];
  urlTags: string | null;
  adId: string;
  accountId: string;
  nome: string;
}) {
  const v = VISUAL[status];
  if (status === "ok")
    return (
      <span title={urlTags ?? undefined}>
        <StatusPill tom={v.tom}>{v.rotulo}</StatusPill>
      </span>
    );
  const linkMeta = `https://adsmanager.facebook.com/adsmanager/manage/ads/edit?act=${accountId.replace(/^act_/, "")}&selected_ad_ids=${adId}`;
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="rounded-full focus-visible:shadow-focus focus-visible:outline-none"
            title="Ver como corrigir"
          />
        }
      >
        <StatusPill tom={v.tom}>{v.rotulo} · como corrigir</StatusPill>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Corrigir o rastreio do anúncio</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-[13px] text-gray2">
          <ul className="flex flex-col gap-1.5">
            {problemas.map((p) => (
              <li
                key={p.texto}
                className={
                  p.gravidade === "erro" ? "text-red" : "text-[#8a5a12]"
                }
              >
                • {p.texto}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
              Hoje no anúncio
            </span>
            <code className="rounded-lg bg-surface-hover/60 p-2 font-mono text-[12px] break-all">
              {urlTags || "(vazio)"}
            </code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
              Cole em “Parâmetros de URL”
            </span>
            <div className="flex items-start gap-2 rounded-lg border border-gray5 p-2">
              <code className="min-w-0 flex-1 font-mono text-[12px] break-all text-darkPurple1">
                {PARAMETROS_META}
              </code>
              <Button
                type="button"
                variant="white"
                size="xs"
                onClick={() =>
                  navigator.clipboard
                    .writeText(PARAMETROS_META)
                    .then(() => toast.success("Parâmetros copiados"))
                }
              >
                <MdContentCopy className="size-3.5" />
                Copiar
              </Button>
            </div>
          </div>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Abra o anúncio no Gerenciador de Anúncios (botão abaixo).</li>
            <li>
              Em <strong>Rastreamento → Parâmetros de URL</strong>, substitua o
              conteúdo pelo texto acima e publique.
            </li>
            <li>
              A verificação é atualizada na próxima sincronização do Marketing
              (todo dia às 07:00, ou em Configurações → Sincronizar agora).
            </li>
          </ol>
          <a
            href={linkMeta}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-purple-text hover:underline"
          >
            <MdOpenInNew className="size-4" /> Abrir o anúncio no Gerenciador
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

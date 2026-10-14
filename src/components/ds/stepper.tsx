import { Fragment, type ReactNode } from "react";
import { MdCheck } from "react-icons/md";
import { cn } from "@/lib/utils";

export interface EtapaStepper {
  titulo: string;
  /** Ex.: "PV-2026-103", "Clicksign · 1/3", "5/12 pagas". */
  subtitulo?: ReactNode;
}

// Stepper do handoff (tela Negócio): círculo 32px — concluída = roxo com
// check; atual = lilás com borda roxa; futura = branco com borda cinza.
// Conector de 2px roxo quando a etapa anterior foi concluída.
// `atual` = índice da etapa corrente; etapas.length marca todas concluídas.
export function Stepper({ etapas, atual, className }: { etapas: EtapaStepper[]; atual: number; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start overflow-x-auto", className)}>
      {etapas.map((etapa, i) => {
        const concluida = i < atual;
        const corrente = i === atual;
        return (
          <Fragment key={etapa.titulo}>
            <li className="flex min-w-[110px] flex-1 flex-col items-center gap-2 px-1 text-center" aria-current={corrente ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300",
                  concluida && "bg-lightPurple1 text-white",
                  corrente && "border-2 border-lightPurple1 bg-lightPurple4 text-purple-text",
                  !concluida && !corrente && "border-[1.5px] border-gray5 bg-surface text-gray3",
                )}
              >
                {concluida ? <MdCheck className="size-[18px]" /> : i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn("text-sm font-bold", concluida || corrente ? "text-darkPurple1" : "text-gray3")}>{etapa.titulo}</span>
                {etapa.subtitulo && <span className="text-xs text-gray3">{etapa.subtitulo}</span>}
              </span>
            </li>
            {i < etapas.length - 1 && (
              <li aria-hidden className={cn("mt-[15px] h-0.5 min-w-4 flex-1", concluida ? "bg-lightPurple1" : "bg-gray5")} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

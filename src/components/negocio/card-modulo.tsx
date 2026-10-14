import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

// Card da tela Negócio (handoff): ícone do módulo em caixa 30px colorida +
// título 18/700; `extra` fica à direita do título (ex.: StatusPill).
export function CardModulo({
  icone: Icone,
  cor,
  titulo,
  extra,
  children,
  className,
}: {
  icone: IconType;
  /** Classe de fundo do token de módulo, ex.: "bg-iconGreen". */
  cor: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-[10px] text-white", cor)}>
          <Icone className="size-4" />
        </span>
        <h2 className="flex-1 text-lg font-bold text-darkPurple1">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Linha chave/valor: rótulo micro à esquerda, valor 600 à direita, divisor --gray5.
 * `longo` quebra o valor (texto corrido) abaixo do rótulo. */
export function LinhaChaveValor({ rotulo, valor, longo = false }: { rotulo: string; valor: ReactNode; longo?: boolean }) {
  const vazio = valor === null || valor === undefined || valor === "";
  return (
    <div
      className={cn(
        "flex gap-4 border-b border-gray5 py-2.5 last:border-0",
        longo ? "flex-col gap-1" : "items-baseline justify-between",
      )}
    >
      <span className="shrink-0 text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{rotulo}</span>
      <span className={cn("text-sm text-darkPurple1", longo ? "whitespace-pre-line" : "text-right font-semibold")}>{vazio ? "—" : valor}</span>
    </div>
  );
}

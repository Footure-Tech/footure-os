import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { MdInbox } from "react-icons/md";
import { cn } from "@/lib/utils";

// Estado vazio do handoff: duas linhas — o problema e como resolver.
// `compacto` = versão dentro de cards (sem o círculo grande do DS).
export function EstadoVazio({
  titulo,
  descricao,
  icone: Icone = MdInbox,
  acao,
  compacto = false,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  icone?: IconType;
  acao?: ReactNode;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2.5 text-center", compacto ? "px-4 py-8" : "px-6 py-12", className)}>
      <span
        className={cn(
          "mb-1.5 flex items-center justify-center rounded-full bg-empty-state text-empty-state-icon",
          compacto ? "size-12" : "size-[72px]",
        )}
      >
        <Icone className={compacto ? "size-6" : "size-8"} />
      </span>
      <span className="text-base font-bold text-darkPurple1">{titulo}</span>
      {descricao && <span className="max-w-[380px] text-sm text-gray3">{descricao}</span>}
      {acao}
    </div>
  );
}

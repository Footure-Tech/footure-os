import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Badge do Footlink DS (components/core/Badge.jsx): 3px 10px, 11px/700
// uppercase +0.04em. Tons literais do DS onde não há token.
export type TomBadge = "purple" | "latam" | "fifa" | "brazil" | "global" | "active" | "inactive" | "pending" | "info";

const CLASSES_TOM: Record<TomBadge, string> = {
  purple: "bg-lightPurple4 text-purple-text",
  latam: "bg-[#e3f2fd] text-[#1565c0]",
  fifa: "bg-[#fff8e1] text-[#e65100]",
  brazil: "bg-[#e8f5e9] text-[#2e7d32]",
  global: "bg-[#f3e5f5] text-[#6a1b9a]",
  active: "bg-green5 text-green1",
  inactive: "bg-dangerBg text-red",
  pending: "bg-orange3 text-[#ce9232]",
  info: "bg-info/15 text-info",
};

export function BadgeTom({ tom = "purple", children, className }: { tom?: TomBadge; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[20px] px-2.5 py-[3px] text-[11px] leading-tight font-bold tracking-[0.04em] whitespace-nowrap uppercase",
        CLASSES_TOM[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Linhas de receita do handoff. Hoje só Footlink existe no sistema (decisão: Academy/Consultoria fora por enquanto). */
export type LinhaReceita = "footlink";

const TOM_LINHA: Record<LinhaReceita, { rotulo: string; tom: TomBadge }> = {
  footlink: { rotulo: "Footlink", tom: "purple" },
};

export function BadgeLinha({ linha = "footlink", className }: { linha?: LinhaReceita; className?: string }) {
  const { rotulo, tom } = TOM_LINHA[linha];
  return (
    <BadgeTom tom={tom} className={className}>
      {rotulo}
    </BadgeTom>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TomStatus } from "@/lib/status/visual";

// Cores do StatusPill do Footlink DS (components/data/StatusPill.jsx).
// in_progress/completed são literais no DS (não há token).
const CLASSES_TOM: Record<TomStatus, string> = {
  in_progress: "bg-[#e1f5fe] text-[#0288d1]",
  completed: "bg-[#e8f5e9] text-[#2e7d32]",
  not_started: "bg-light text-gray",
  active: "bg-green5 text-green1",
  inactive: "bg-dangerBg text-red",
  pending: "bg-orange3 text-[#ce9232]",
};

export function StatusPill({ tom, children, className }: { tom: TomStatus; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[20px] px-3 py-1 text-[11px] leading-none font-bold whitespace-nowrap uppercase",
        CLASSES_TOM[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

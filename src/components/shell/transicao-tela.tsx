"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Layouts persistem entre navegações no App Router, então a animação de
// entrada (fadeInAnim do handoff) só repete se o wrapper remontar — a key
// pelo pathname força isso a cada troca de tela.
export function TransicaoTela({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in-page">
      {children}
    </div>
  );
}

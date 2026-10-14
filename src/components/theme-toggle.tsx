"use client";

import { MdDarkMode, MdLightMode } from "react-icons/md";
import { cn } from "@/lib/utils";
import { useTema } from "@/hooks/use-tema";

// Botão sol/lua. Estilo padrão = o da AppBar do handoff (38×38, radius 8,
// branco translúcido sobre o roxo); className permite reposicionar.
export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const escuro = tema === "dark";
  const rotulo = escuro ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "flex size-[38px] shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-all duration-200 ease-in-out hover:bg-white/20 focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
    >
      {escuro ? <MdLightMode className="size-5" /> : <MdDarkMode className="size-5" />}
    </button>
  );
}

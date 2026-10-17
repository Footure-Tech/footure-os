"use client";

import { useOptimistic, useTransition } from "react";
import type { ContextoDados } from "@/lib/contexto/contexto";
import { definirContextoDadosAction } from "@/lib/contexto/actions";
import { cn } from "@/lib/utils";

const OPCOES: { valor: ContextoDados; rotulo: string }[] = [
  { valor: "footlink", rotulo: "Footlink" },
  { valor: "academy", rotulo: "Academy" },
];

// Seletor do contexto dos dados na AppBar (fundo preto nos dois temas).
export function SeletorContexto({ contexto }: { contexto: ContextoDados }) {
  const [atual, definirOtimista] = useOptimistic(contexto);
  const [trocando, iniciar] = useTransition();

  return (
    <div role="radiogroup" aria-label="Contexto dos dados" aria-busy={trocando} className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-lg bg-white/10 p-1">
      {OPCOES.map((o) => {
        const ativo = atual === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() =>
              !ativo &&
              iniciar(async () => {
                definirOtimista(o.valor);
                await definirContextoDadosAction(o.valor);
              })
            }
            className={cn(
              "h-full rounded-md px-3.5 text-sm font-semibold transition-all duration-200 focus-visible:shadow-focus focus-visible:outline-none",
              ativo ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

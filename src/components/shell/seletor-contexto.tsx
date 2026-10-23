"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ContextoDados } from "@/lib/contexto/contexto";
import { definirContextoDadosAction } from "@/lib/contexto/actions";
import { ENTRADA_GESTAO, emGestao } from "@/lib/contexto/gestao";
import { cn } from "@/lib/utils";

type Aba = ContextoDados | "gestao";

const OPCOES: { valor: Aba; rotulo: string }[] = [
  { valor: "footlink", rotulo: "Footlink" },
  { valor: "academy", rotulo: "Academy" },
  { valor: "gestao", rotulo: "Gestão" },
];

// Seletor do contexto dos dados na AppBar (fundo preto nos dois temas).
// "Gestão" (só Diretoria) leva às telas exclusivas da Diretoria; ao voltar
// para Footlink/Academy a partir de lá, abre o Dashboard.
export function SeletorContexto({ contexto, comGestao = false }: { contexto: ContextoDados; comGestao?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const naGestao = comGestao && emGestao(pathname);
  const [atual, definirOtimista] = useOptimistic<Aba>(naGestao ? "gestao" : contexto);
  const [trocando, iniciar] = useTransition();

  function escolher(valor: Aba) {
    iniciar(async () => {
      definirOtimista(valor);
      if (valor === "gestao") {
        router.push(ENTRADA_GESTAO);
        return;
      }
      if (valor !== contexto) await definirContextoDadosAction(valor);
      if (naGestao) router.push("/dashboard");
    });
  }

  return (
    <div role="radiogroup" aria-label="Contexto dos dados" aria-busy={trocando} className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-lg bg-white/10 p-1">
      {OPCOES.filter((o) => comGestao || o.valor !== "gestao").map((o) => {
        const ativo = atual === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => !ativo && escolher(o.valor)}
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

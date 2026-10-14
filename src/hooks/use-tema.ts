"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CHAVE_TEMA, type Tema } from "@/lib/tema";

// O atributo data-theme do <html> é a fonte da verdade (o script inicial já o
// definiu antes da hidratação) — o hook só observa e altera esse atributo,
// então todos os componentes que usam o tema ficam em sincronia sem Context.
function lerTema(): Tema {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function assinar(aoMudar: () => void) {
  const observer = new MutationObserver(aoMudar);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useTema() {
  const tema = useSyncExternalStore<Tema>(assinar, lerTema, () => "light");

  const definirTema = useCallback((novo: Tema) => {
    document.documentElement.setAttribute("data-theme", novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo);
    } catch {
      // localStorage indisponível (modo privado) — o tema vale só para esta aba.
    }
  }, []);

  const alternarTema = useCallback(() => definirTema(lerTema() === "dark" ? "light" : "dark"), [definirTema]);

  return { tema, definirTema, alternarTema };
}

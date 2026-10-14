"use client";

import type { ComponentProps, KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Linha de tabela inteira clicável (handoff: listas abrem a tela de detalhe).
// Cliques em elementos interativos dentro da linha (botões, links, inputs)
// não navegam — eles seguem com a própria ação.
export function LinhaClicavel({ href, className, children, ...props }: ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();

  function deveIgnorar(alvo: EventTarget | null) {
    return alvo instanceof Element && !!alvo.closest("a, button, input, select, textarea, [role=menuitem], [data-nao-navega]");
  }

  function aoClicar(e: MouseEvent<HTMLTableRowElement>) {
    if (deveIgnorar(e.target)) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(href, "_blank");
      return;
    }
    router.push(href);
  }

  function aoTeclar(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" && !deveIgnorar(e.target)) router.push(href);
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      onMouseEnter={() => router.prefetch(href)}
      className={cn("cursor-pointer focus-visible:bg-surface-hover focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}

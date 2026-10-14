"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Abas de filtro e SegmentedToggle do handoff. Cada opção navega por `href`
// (filtro na URL, para páginas Server Component) ou chama `onChange`
// (estado local). O ativo troca a borda cinza por transparente, sem mudar o
// tamanho do botão.

export interface OpcaoAlternador<T extends string> {
  valor: T;
  rotulo: ReactNode;
  href?: string;
  /** Só nas abas de filtro: contador ao lado do rótulo. */
  contagem?: number;
}

function Opcao<T extends string>({
  opcao,
  ativa,
  onChange,
  className,
  children,
}: {
  opcao: OpcaoAlternador<T>;
  ativa: boolean;
  onChange?: (valor: T) => void;
  className: string;
  children: ReactNode;
}) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-semibold whitespace-nowrap transition-all duration-200 focus-visible:shadow-focus focus-visible:outline-none",
    ativa
      ? "border-transparent bg-segment-active text-segment-active-foreground"
      : "border-lightBorder bg-surface text-dark hover:bg-surface-hover",
    className,
  );
  if (opcao.href) {
    return (
      <Link href={opcao.href} aria-current={ativa ? "page" : undefined} className={classes} scroll={false}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={ativa} onClick={() => onChange?.(opcao.valor)} className={classes}>
      {children}
    </button>
  );
}

/** Abas de filtro (ex.: Contratos): 38px de altura, com contador. */
export function AbasFiltro<T extends string>({
  opcoes,
  valor,
  onChange,
  className,
}: {
  opcoes: OpcaoAlternador<T>[];
  valor: T;
  onChange?: (valor: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-2.5", className)}>
      {opcoes.map((opcao) => (
        <Opcao key={opcao.valor} opcao={opcao} ativa={opcao.valor === valor} onChange={onChange} className="h-[38px] px-4">
          {opcao.rotulo}
          {opcao.contagem !== undefined && <span className="text-xs font-extrabold opacity-80">{opcao.contagem}</span>}
        </Opcao>
      ))}
    </div>
  );
}

/** SegmentedToggle do DS: 42px de altura, gap 10 (período, layout, Kanban/Tabela...). */
export function SegmentedToggle<T extends string>({
  opcoes,
  valor,
  onChange,
  className,
}: {
  opcoes: OpcaoAlternador<T>[];
  valor: T;
  onChange?: (valor: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {opcoes.map((opcao) => (
        <Opcao key={opcao.valor} opcao={opcao} ativa={opcao.valor === valor} onChange={onChange} className="h-[42px] px-5">
          {opcao.rotulo}
        </Opcao>
      ))}
    </div>
  );
}

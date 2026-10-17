"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PeriodoCurso } from "@/lib/academy/relatorio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Troca o curso do relatório mantendo o período selecionado.
export function SeletorCurso({ cursos, atual, periodo }: { cursos: { slug: string; nome: string }[]; atual: string; periodo: PeriodoCurso }) {
  const router = useRouter();
  const [trocando, iniciar] = useTransition();
  return (
    <Select
      items={Object.fromEntries(cursos.map((c) => [c.slug, c.nome]))}
      value={atual}
      onValueChange={(slug) => {
        if (!slug || slug === atual) return;
        iniciar(() => router.push(periodo === "tudo" ? `/vendas/cursos/${slug}` : `/vendas/cursos/${slug}?periodo=${periodo}`));
      }}
    >
      <SelectTrigger aria-label="Trocar de curso" aria-busy={trocando} className="w-[min(420px,100%)]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cursos.map((c) => (
          <SelectItem key={c.slug} value={c.slug}>
            {c.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

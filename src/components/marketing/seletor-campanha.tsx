"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODAS = "__todas__";

// Filtro de campanha da Visão A (depende da BU): navega mantendo período e BU.
export function SeletorCampanha({
  opcoes,
  valor,
  hrefBase,
}: {
  opcoes: { valor: string; rotulo: string }[];
  valor: string | null;
  hrefBase: string;
}) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  return (
    <Select
      items={{
        [TODAS]: "Todas as campanhas",
        ...Object.fromEntries(opcoes.map((o) => [o.valor, o.rotulo])),
      }}
      value={valor ?? TODAS}
      onValueChange={(v) => {
        const url = new URL(hrefBase, "http://x");
        if (v && v !== TODAS) url.searchParams.set("campanha", String(v));
        else url.searchParams.delete("campanha");
        iniciar(() =>
          router.push(`${url.pathname}${url.search}`, { scroll: false }),
        );
      }}
    >
      <SelectTrigger
        aria-label="Filtrar por campanha"
        aria-busy={carregando}
        className="w-[min(320px,100%)]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas as campanhas</SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

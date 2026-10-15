"use client";

import { useRouter } from "next/navigation";
import { MdExpandMore } from "react-icons/md";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { StatusPagamento } from "@/lib/financeiro/carteira";
import { cn } from "@/lib/utils";

export const ROTULO_STATUS_PAGAMENTO: Record<StatusPagamento, string> = {
  em_aberto: "Em aberto",
  atrasada: "Atrasada",
  paga: "Paga",
};
const TODOS: StatusPagamento[] = ["em_aberto", "atrasada", "paga"];

// Seleção múltipla de status (droplist). O estado vive na URL (?status=),
// junto com o mês, para o filtro sobreviver à troca de mês e ao recarregar.
export function FiltroStatusPagamento({ mes, selecionados }: { mes: string; selecionados: StatusPagamento[] }) {
  const router = useRouter();

  function alternar(status: StatusPagamento) {
    const novos = selecionados.includes(status) ? selecionados.filter((s) => s !== status) : [...selecionados, status];
    const params = new URLSearchParams({ mes });
    if (novos.length > 0 && novos.length < TODOS.length) params.set("status", novos.join(","));
    router.push(`/financeiro/pagamentos?${params}`, { scroll: false });
  }

  const ativo = selecionados.length > 0 && selecionados.length < TODOS.length;
  const rotulo = !ativo ? "Todos os status" : selecionados.length === 1 ? ROTULO_STATUS_PAGAMENTO[selecionados[0]] : `${selecionados.length} status`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-[38px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all duration-200 focus-visible:shadow-focus focus-visible:outline-none",
          ativo ? "border-transparent bg-segment-active text-segment-active-foreground" : "border-lightBorder bg-surface text-dark hover:bg-surface-hover",
        )}
      >
        {rotulo}
        <MdExpandMore className="size-[18px] opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {TODOS.map((s) => (
          <DropdownMenuCheckboxItem key={s} checked={ativo && selecionados.includes(s)} onCheckedChange={() => alternar(s)} onSelect={(e) => e.preventDefault()}>
            {ROTULO_STATUS_PAGAMENTO[s]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

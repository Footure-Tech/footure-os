"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdCheck } from "react-icons/md";
import { cn } from "@/lib/utils";
import { ITENS_VALIDACAO } from "@/lib/contratos/validacao";
import { marcarItemValidacaoAction } from "@/lib/pedidos/serverActions";
import { formatarDataCurta } from "@/lib/formatacao";
import type { ItemValidacaoContrato } from "@/lib/supabase/database.types";

export interface ItemMarcado {
  item: ItemValidacaoContrato;
  marcadoEm: string;
  marcadoPor: string | null;
}

// Checklist de validação jurídica (handoff): checkbox 20px radius 6, marcado
// = verde com check branco. Salvo por versão do contrato (0029) — editável só
// enquanto o contrato está em validação.
export function ChecklistValidacao({
  pedidoId,
  contratoId,
  marcados,
  editavel,
}: {
  pedidoId: string;
  contratoId: string;
  marcados: ItemMarcado[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [otimista, aplicar] = useOptimistic(
    marcados,
    (atual: ItemMarcado[], { item, marcado }: { item: ItemValidacaoContrato; marcado: boolean }) =>
      marcado ? [...atual.filter((m) => m.item !== item), { item, marcadoEm: new Date().toISOString(), marcadoPor: null }] : atual.filter((m) => m.item !== item),
  );

  function alternar(item: ItemValidacaoContrato, marcado: boolean) {
    iniciar(async () => {
      aplicar({ item, marcado });
      try {
        await marcarItemValidacaoAction(pedidoId, contratoId, item, marcado);
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao salvar a validação.");
      }
    });
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {ITENS_VALIDACAO.map(({ item, rotulo }) => {
        const marcacao = otimista.find((m) => m.item === item);
        const marcado = !!marcacao;
        return (
          <li key={item}>
            <button
              type="button"
              role="checkbox"
              aria-checked={marcado}
              disabled={!editavel}
              onClick={() => alternar(item, !marcado)}
              className="group flex w-full items-start gap-3 rounded-lg text-left focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-default"
            >
              <span
                className={cn(
                  "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
                  marcado ? "border-green1 bg-green1 text-white" : "border-lightBorder bg-surface group-enabled:group-hover:border-green1",
                )}
              >
                {marcado && <MdCheck className="size-3.5" />}
              </span>
              <span className="flex flex-col">
                <span className={cn("text-sm", marcado ? "font-semibold text-darkPurple1" : "text-gray2")}>{rotulo}</span>
                {marcacao && (
                  <span className="text-xs text-gray3">
                    Conferido{marcacao.marcadoPor ? ` por ${marcacao.marcadoPor}` : ""} em {formatarDataCurta(marcacao.marcadoEm)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

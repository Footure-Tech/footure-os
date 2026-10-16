"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MdSync } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { reenviarAoBlingAction } from "@/lib/pedidos/serverActions";

// "Reenviar ao Bling" — refaz o envio do pedido aprovado sem duplicar no Bling.
export function ReenviarBlingButton({ pedidoId }: { pedidoId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await reenviarAoBlingAction(pedidoId);
          if (r.erro) toast.error("Não foi possível enviar ao Bling", { description: r.erro });
          else if (r.aviso) toast.warning("Pedido enviado ao Bling, com ressalva", { description: r.aviso });
          else toast.success(r.numero ? `Pedido enviado ao Bling · nº ${r.numero}` : "Pedido enviado ao Bling");
        })
      }
    >
      <MdSync className="size-4" />
      {pendente ? "Enviando…" : "Reenviar ao Bling"}
    </Button>
  );
}

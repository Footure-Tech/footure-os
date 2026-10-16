"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { desativarAjusteModeloAction } from "@/lib/contratos/analiseActions";

export function DesativarAjusteButton({ ajusteId }: { ajusteId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="white"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await desativarAjusteModeloAction(ajusteId);
          if (r.erro) toast.error("Não foi possível desativar", { description: r.erro });
          else toast.success("Ajuste desativado — os próximos contratos voltam ao texto original");
        })
      }
    >
      Desativar
    </Button>
  );
}

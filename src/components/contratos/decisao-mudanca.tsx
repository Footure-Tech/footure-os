"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MdCheck } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { decidirMudancaAction } from "@/lib/contratos/analiseActions";

// Botões de decisão do jurídico sobre uma mudança da nova versão.
export function DecisaoMudanca({ mudancaId, podeAgregar }: { mudancaId: string; podeAgregar: boolean }) {
  const [pendente, iniciar] = useTransition();
  const decidir = (decisao: "agregar" | "manter") =>
    iniciar(async () => {
      const r = await decidirMudancaAction(mudancaId, decisao);
      if (r.erro) toast.error(decisao === "agregar" ? "Não foi possível agregar ao modelo" : "Não foi possível salvar", { description: r.erro });
      else toast.success(decisao === "agregar" ? "Agregado ao modelo — os próximos contratos já saem com o novo texto" : "Mantido só neste contrato");
    });
  return (
    <div className="flex flex-wrap gap-2">
      {podeAgregar && (
        <Button type="button" size="sm" disabled={pendente} onClick={() => decidir("agregar")}>
          <MdCheck className="size-4" />
          Agregar ao modelo
        </Button>
      )}
      <Button type="button" size="sm" variant="white" disabled={pendente} onClick={() => decidir("manter")}>
        Manter só neste contrato
      </Button>
    </div>
  );
}

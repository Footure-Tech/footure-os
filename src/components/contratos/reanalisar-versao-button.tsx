"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdRefresh } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AnaliseEmAndamento } from "@/components/pedido/analise-em-andamento";
import { reanalisarVersaoAction } from "@/lib/contratos/analiseActions";

// Refaz a análise da versão contra o modelo atual, com o loader animado enquanto roda.
export function ReanalisarVersaoButton({ contratoId }: { contratoId: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="white"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await reanalisarVersaoAction(contratoId);
            if (r.erro) toast.error("Não foi possível reanalisar", { description: r.erro });
            else toast.success("Análise refeita com o modelo atual");
            router.refresh();
          })
        }
      >
        <MdRefresh className="size-4" />
        Reanalisar com o modelo atual
      </Button>
      <Dialog open={pendente}>
        <DialogContent showCloseButton={false}>
          <DialogTitle className="sr-only">Analisando a versão</DialogTitle>
          <AnaliseEmAndamento etapa="analisando" />
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sincronizarContatosBlingAction } from "@/lib/clientes/serverActions";

export function SincronizarBlingButton() {
  const [pendente, iniciar] = useTransition();

  function aoClicar() {
    iniciar(async () => {
      try {
        const { totalContatos, novosClientesRegistrados } = await sincronizarContatosBlingAction();
        toast.success(
          `${totalContatos} clientes sincronizados do Bling` +
            (novosClientesRegistrados > 0 ? ` (${novosClientesRegistrados} cadastrados agora pela primeira vez).` : "."),
        );
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao sincronizar com o Bling.");
      }
    });
  }

  return (
    <Button variant="outline" onClick={aoClicar} disabled={pendente}>
      <RefreshCw className={pendente ? "size-4 animate-spin" : "size-4"} />
      {pendente ? "Sincronizando…" : "Sincronizar com o Bling"}
    </Button>
  );
}

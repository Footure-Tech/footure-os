"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MdSync } from "react-icons/md";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sincronizarContatosBlingAction } from "@/lib/clientes/serverActions";
import { cn } from "@/lib/utils";

// Sincronização sob demanda com o Bling (contatos + parcelas em cache).
// Usado em Clientes e em Financeiro · Contratos e parcelas.
export function SincronizarBlingButton({ rotulo = "Sincronizar" }: { rotulo?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function aoClicar() {
    iniciar(async () => {
      try {
        const { novosClientesRegistrados, baixasImportadas } = await sincronizarContatosBlingAction();
        toast.success(
          `Bling sincronizado · ${baixasImportadas} ${baixasImportadas === 1 ? "baixa de pagamento importada" : "baixas de pagamento importadas"}` +
            (novosClientesRegistrados > 0 ? ` · ${novosClientesRegistrados} novos clientes` : ""),
        );
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao sincronizar com o Bling.");
      }
    });
  }

  return (
    <Button variant="secondary" onClick={aoClicar} disabled={pendente}>
      <MdSync className={cn("size-[18px]", pendente && "animate-spin")} />
      {pendente ? "Sincronizando…" : rotulo}
    </Button>
  );
}

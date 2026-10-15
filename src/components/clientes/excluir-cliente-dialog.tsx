"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdDelete } from "react-icons/md";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { excluirClienteAction } from "@/lib/clientes/serverActions";

export function ExcluirClienteDialog({
  clienteId,
  razaoSocial,
  totalPedidos,
}: {
  clienteId: string;
  razaoSocial: string;
  totalPedidos: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  if (totalPedidos > 0) {
    return (
      <Button variant="white" size="icon-sm" className="size-[34px]" disabled title="Cliente possui pedidos vinculados — não pode ser excluído." aria-label="Excluir cliente">
        <MdDelete className="size-4" />
      </Button>
    );
  }

  function confirmar() {
    iniciar(async () => {
      try {
        await excluirClienteAction(clienteId);
        toast.success("Cliente excluído.");
        setAberto(false);
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao excluir cliente.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="white" size="icon-sm" className="size-[34px] text-red" aria-label="Excluir cliente" title="Excluir cliente" />}>
        <MdDelete className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir cliente</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir &quot;{razaoSocial}&quot;? Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" variant="destructive" disabled={pendente} onClick={confirmar}>
            {pendente ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

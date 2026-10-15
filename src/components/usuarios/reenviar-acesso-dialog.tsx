"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MdForwardToInbox } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { reenviarAcessoAction } from "@/lib/usuarios/serverActions";

// Gera nova senha temporária e reenvia o e-mail de acesso — pede confirmação
// porque a senha atual do usuário deixa de valer.
export function ReenviarAcessoDialog({ userId, nome }: { userId: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      try {
        await reenviarAcessoAction(userId);
        toast.success(`Acesso reenviado para ${nome}`, { description: "Uma nova senha temporária foi enviada por e-mail." });
        setAberto(false);
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao reenviar o acesso.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="white" size="sm" />}>
        <MdForwardToInbox className="size-4" />
        Reenviar acesso
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reenviar acesso para {nome}?</DialogTitle>
          <DialogDescription>
            Uma nova senha temporária será gerada e enviada por e-mail. A senha atual deixa de valer imediatamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pendente} onClick={confirmar}>
            {pendente ? "Enviando…" : "Gerar e enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

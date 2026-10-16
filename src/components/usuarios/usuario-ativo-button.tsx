"use client";

import { exigirSucesso } from "@/lib/resultadoAcao";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdPersonOff, MdHowToReg } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { definirAtivoUsuario } from "@/lib/usuarios/serverActions";

export function UsuarioAtivoButton({ userId, ativo }: { userId: string; ativo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function alternar() {
    iniciar(async () => {
      try {
        exigirSucesso(await definirAtivoUsuario(userId, !ativo));
        toast.success(ativo ? "Usuário inativado." : "Usuário ativado.");
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao atualizar usuário.");
      }
    });
  }

  return (
    <Button type="button" variant={ativo ? "white" : "secondary"} size="sm" className={ativo ? "text-red" : undefined} disabled={pendente} onClick={alternar}>
      {ativo ? <MdPersonOff className="size-4" /> : <MdHowToReg className="size-4" />}
      {ativo ? "Inativar" : "Ativar"}
    </Button>
  );
}

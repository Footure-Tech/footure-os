"use client";

import { exigirSucesso } from "@/lib/resultadoAcao";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdEdit, MdPersonAdd } from "react-icons/md";
import { ROTULO_PERFIL } from "@/lib/auth/perfis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { criarUsuario, editarUsuario } from "@/lib/usuarios/serverActions";
import type { PapelUsuario } from "@/lib/supabase/database.types";

// Nomes de exibição do handoff (Diretoria = admin, Comercial = vendedor).
const ROTULO_PAPEL = ROTULO_PERFIL;

type Props =
  | { modo: "criar" }
  | { modo: "editar"; usuario: { id: string; nome: string; papel: PapelUsuario } };

export function UsuarioFormDialog(props: Props) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(props.modo === "editar" ? props.usuario.nome : "");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelUsuario>(props.modo === "editar" ? props.usuario.papel : "vendedor");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function confirmar() {
    iniciar(async () => {
      try {
        if (props.modo === "criar") {
          exigirSucesso(await criarUsuario({ nome, email, papel }));
          toast.success("Usuário criado — e-mail com a senha temporária enviado.");
        } else {
          exigirSucesso(await editarUsuario(props.usuario.id, { nome, papel }));
          toast.success("Usuário atualizado.");
        }
        setAberto(false);
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao salvar usuário.");
      }
    });
  }

  function aoFechar(open: boolean) {
    setAberto(open);
    if (!open && props.modo === "criar") {
      setNome("");
      setEmail("");
      setPapel("vendedor");
    }
  }

  const podeConfirmar = props.modo === "criar" ? !!nome.trim() && !!email.trim() : !!nome.trim();

  return (
    <Dialog open={aberto} onOpenChange={aoFechar}>
      {props.modo === "criar" ? (
        <DialogTrigger render={<Button type="button" />}>
          <MdPersonAdd className="size-[18px]" />
          Adicionar usuário
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button type="button" variant="white" size="sm" />}>
          <MdEdit className="size-4" />
          Editar
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.modo === "criar" ? "Adicionar usuário" : "Editar usuário"}</DialogTitle>
          {props.modo === "criar" && (
            <DialogDescription>
              Um e-mail com uma senha temporária de acesso é enviado automaticamente pro endereço informado.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label variante="campo">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          {props.modo === "criar" && (
            <div className="flex flex-col gap-2">
              <Label variante="campo">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label variante="campo">Perfil</Label>
            <Select items={ROTULO_PAPEL} value={papel} onValueChange={(v) => v && setPapel(v as PapelUsuario)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ROTULO_PAPEL) as [PapelUsuario, string][]).map(([valor, rotulo]) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pendente || !podeConfirmar} onClick={confirmar}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvisoAuth } from "@/components/auth/moldura-auth";
import { alterarSenhaAction, type EstadoSenha } from "@/lib/auth/senhaActions";

const ESTADO_INICIAL: EstadoSenha = {};

export function FormAlterarSenha() {
  const [estado, formAction, pendente] = useActionState(alterarSenhaAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.sucesso) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label variante="campo" htmlFor="atual">
          Senha atual
        </Label>
        <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <div className="flex flex-col gap-2">
          <Label variante="campo" htmlFor="nova">
            Nova senha
          </Label>
          <Input id="nova" name="nova" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label variante="campo" htmlFor="confirmacao">
            Confirmar nova senha
          </Label>
          <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </div>
      <p className="-mt-1 text-xs text-gray3">Pelo menos 8 caracteres.</p>
      {estado.erro && <AvisoAuth tipo="erro">{estado.erro}</AvisoAuth>}
      {estado.sucesso && <AvisoAuth tipo="sucesso">{estado.sucesso}</AvisoAuth>}
      <Button type="submit" disabled={pendente} className="self-end">
        {pendente ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  );
}

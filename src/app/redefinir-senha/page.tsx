"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvisoAuth, MolduraAuth } from "@/components/auth/moldura-auth";
import { definirNovaSenhaAction, type EstadoSenha } from "@/lib/auth/senhaActions";

const ESTADO_INICIAL: EstadoSenha = {};

// Aberta a partir do link do e-mail: /auth/confirmar já criou a sessão.
export default function RedefinirSenhaPage() {
  const [estado, formAction, pendente] = useActionState(definirNovaSenhaAction, ESTADO_INICIAL);

  return (
    <MolduraAuth titulo="Criar nova senha" descricao="Escolha uma senha com pelo menos 8 caracteres.">
      <form action={formAction} className="flex flex-col gap-4">
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
        {estado.erro && <AvisoAuth tipo="erro">{estado.erro}</AvisoAuth>}
        <Button type="submit" disabled={pendente} className="w-full">
          {pendente ? "Salvando…" : "Salvar e entrar"}
        </Button>
      </form>
    </MolduraAuth>
  );
}

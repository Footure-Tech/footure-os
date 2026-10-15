"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvisoAuth, MolduraAuth } from "@/components/auth/moldura-auth";
import { entrar, type LoginState } from "./actions";

const ESTADO_INICIAL: LoginState = {};

export function FormLogin({ aviso }: { aviso?: { tipo: "erro" | "info"; texto: string } }) {
  const [estado, formAction, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <MolduraAuth titulo="Entrar" descricao="Use o e-mail e a senha da sua conta.">
      {aviso && <AvisoAuth tipo={aviso.tipo}>{aviso.texto}</AvisoAuth>}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label variante="campo" htmlFor="email">
            E-mail
          </Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label variante="campo" htmlFor="senha">
              Senha
            </Label>
            <Link href="/esqueci-senha" className="text-xs font-semibold text-purple-text hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
        </div>
        {estado.erro && <AvisoAuth tipo="erro">{estado.erro}</AvisoAuth>}
        <Button type="submit" disabled={pendente} className="mt-1 w-full">
          {pendente ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </MolduraAuth>
  );
}

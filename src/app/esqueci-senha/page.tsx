"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvisoAuth, MolduraAuth } from "@/components/auth/moldura-auth";
import { solicitarRedefinicaoAction, type EstadoSenha } from "@/lib/auth/senhaActions";

const ESTADO_INICIAL: EstadoSenha = {};

export default function EsqueciSenhaPage() {
  const [estado, formAction, pendente] = useActionState(solicitarRedefinicaoAction, ESTADO_INICIAL);

  return (
    <MolduraAuth titulo="Esqueci minha senha" descricao="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.">
      {estado.sucesso ? (
        <AvisoAuth tipo="sucesso">{estado.sucesso}</AvisoAuth>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label variante="campo" htmlFor="email">
              E-mail
            </Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {estado.erro && <AvisoAuth tipo="erro">{estado.erro}</AvisoAuth>}
          <Button type="submit" disabled={pendente} className="w-full">
            {pendente ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="text-center text-sm font-semibold text-purple-text hover:underline">
        Voltar para o login
      </Link>
    </MolduraAuth>
  );
}

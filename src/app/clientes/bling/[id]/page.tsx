import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarDetalheContatoBling } from "@/lib/integracoes/bling";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogoCliente } from "@/components/clientes/logo-cliente";

/**
 * Visualização de um contato do Bling que ainda não tem cadastro local
 * (sem perfil/endereço-pra-contrato/foro/logo definidos aqui) — mostra os
 * dados oficiais do Bling e direciona pro cadastro quando fizer sentido criar
 * o complemento local. Só leitura por enquanto: ainda não existe uma
 * funcionalidade de editar e sincronizar de volta com o Bling.
 */
export default async function ClienteBlingDetalhePage({ params }: PageProps<"/clientes/bling/[id]">) {
  const { id } = await params;
  const idContato = Number(id);
  if (!Number.isFinite(idContato)) notFound();

  const supabase = await createClient();
  const contato = await buscarDetalheContatoBling(supabase, idContato);
  if (!contato) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoCliente url={null} nome={contato.nome} tamanho="md" />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{contato.nome}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {contato.fantasia && <span>{contato.fantasia}</span>}
              <span>{formatarCnpj(contato.cnpj)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">Não cadastrado no sistema</Badge>
          <Button nativeButton={false} render={<Link href={`/clientes/novo?blingContatoId=${contato.id}`}>Cadastrar no sistema</Link>} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" strokeWidth={2} />
            <CardTitle>Dados do Bling</CardTitle>
          </div>
          <CardDescription>
            Este contato ainda não tem perfil, endereço de contrato, foro ou logo definidos no sistema — complete o cadastro pra
            isso.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Razão social</p>
            <p>{contato.nome}</p>
          </div>
          {contato.fantasia && (
            <div>
              <p className="text-muted-foreground">Nome fantasia</p>
              <p>{contato.fantasia}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">CNPJ</p>
            <p>{formatarCnpj(contato.cnpj)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Endereço</p>
            <p>{formatarEnderecoCliente(contato) || "—"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

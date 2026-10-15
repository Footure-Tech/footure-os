import Link from "next/link";
import { notFound } from "next/navigation";
import { MdBusiness, MdPersonAdd } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { buscarDetalheContatoBling } from "@/lib/integracoes/bling";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { STATUS_CLIENTE_NAO_CADASTRADO } from "@/lib/status/visual";
import { Button } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ds/status-pill";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";

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
    <div className="flex max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <BotaoVoltar href="/clientes" />
        <LogoCliente url={null} nome={contato.nome} tamanho="lg" />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.01em] text-darkPurple1">{contato.fantasia || contato.nome}</h1>
            <StatusPill tom={STATUS_CLIENTE_NAO_CADASTRADO.tom}>{STATUS_CLIENTE_NAO_CADASTRADO.rotulo}</StatusPill>
          </div>
          <span className="text-sm text-gray">Contato do Bling • {formatarCnpj(contato.cnpj)}</span>
        </div>
        <Button nativeButton={false} render={<Link href={`/clientes/novo?blingContatoId=${contato.id}`} />}>
          <MdPersonAdd className="size-[18px]" />
          Cadastrar no sistema
        </Button>
      </div>

      <div className="max-w-[720px]">
        <CardModulo icone={MdBusiness} cor="bg-iconBlue" titulo="Dados do Bling">
          <p className="-mt-1 rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
            Este contato ainda não tem perfil, endereço de contrato, foro ou logo definidos no sistema — complete o cadastro para isso.
          </p>
          <div className="flex flex-col">
            <LinhaChaveValor rotulo="Razão social" valor={contato.nome} longo />
            {contato.fantasia && <LinhaChaveValor rotulo="Nome fantasia" valor={contato.fantasia} />}
            <LinhaChaveValor rotulo="CNPJ" valor={formatarCnpj(contato.cnpj)} />
            <LinhaChaveValor rotulo="Endereço" valor={formatarEnderecoCliente(contato)} longo />
          </div>
        </CardModulo>
      </div>
    </div>
  );
}

import Link from "next/link";
import { MdAdd, MdBusiness } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { listarClientesComContagemPedidos, urlLogoCliente } from "@/lib/clientes/consultas";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { BuscaClientes } from "@/components/clientes/busca-clientes";
import { SincronizarBlingButton } from "@/components/clientes/sincronizar-bling-button";
import { ClientesTabela } from "@/components/clientes/clientes-tabela";

export default async function ClientesPage() {
  const supabase = await createClient();
  const clientes = await listarClientesComContagemPedidos(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial"
        titulo="Clientes"
        descricao="Clubes e agentes com pedido de venda no Bling — a base oficial de razão social, CNPJ e endereço."
        acoes={
          <>
            <SincronizarBlingButton rotulo="Sincronizar com o Bling" />
            <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
              <MdAdd className="size-[18px]" />
              Novo cliente
            </Button>
          </>
        }
      />

      {clientes.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdBusiness}
            titulo="Nenhum cliente importado ainda"
            descricao="Use “Sincronizar com o Bling” para importar os clientes (pessoa jurídica com pedido de venda)."
          />
        </div>
      ) : (
        <>
          <BuscaClientes
            clientes={clientes.map((c) => ({
              blingContatoId: c.blingContatoId,
              clienteId: c.clienteId,
              razaoSocial: c.razaoSocial,
              nomeFantasia: c.nomeFantasia,
            }))}
          />
          <ClientesTabela
            clientes={clientes.map((c) => ({
              blingContatoId: c.blingContatoId,
              clienteId: c.clienteId,
              razaoSocial: c.razaoSocial,
              nomeFantasia: c.nomeFantasia,
              tipo: c.tipo,
              totalPedidosLocais: c.totalPedidosLocais,
              totalParcelas: c.totalParcelas,
              parcelasEmitidas: c.parcelasEmitidas,
              parcelasAtrasadas: c.parcelasAtrasadas,
              situacao: c.situacao,
              cadastradoNoSistema: c.cadastradoNoSistema,
              logoUrl: urlLogoCliente(supabase, c.logoPath),
            }))}
          />
        </>
      )}
    </div>
  );
}

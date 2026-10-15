import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarClientesComContagemPedidos, urlLogoCliente } from "@/lib/clientes/consultas";
import { Button } from "@/components/ui/button";
import { BuscaClientes } from "@/components/clientes/busca-clientes";
import { SincronizarBlingButton } from "@/components/clientes/sincronizar-bling-button";
import { ClientesTabela } from "@/components/clientes/clientes-tabela";

export default async function ClientesPage() {
  const supabase = await createClient();
  const clientes = await listarClientesComContagemPedidos(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <div className="flex items-center gap-2">
          <SincronizarBlingButton rotulo="Sincronizar com o Bling" />
          <Button nativeButton={false} render={<Link href="/clientes/novo">Novo cliente</Link>} />
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contato encontrado ainda. Clique em &quot;Sincronizar com o Bling&quot; para importar os clientes (pessoa jurídica).
        </p>
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

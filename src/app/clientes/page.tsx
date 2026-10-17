import Link from "next/link";
import { MdAdd, MdBusiness } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { listarClientesComContagemPedidos, urlLogoCliente } from "@/lib/clientes/consultas";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { BuscaClientes } from "@/components/clientes/busca-clientes";
import { ClientesTabela } from "@/components/clientes/clientes-tabela";
import { TabelaClientesAcademy } from "@/components/clientes/tabela-clientes-academy";
import { carregarCarteiraAcademy, compradoresAcademy } from "@/lib/academy/carteira";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { MdSchool } from "react-icons/md";

export default async function ClientesPage() {
  const supabase = await createClient();
  if ((await lerContextoDados()) === "academy") {
    const compradores = compradoresAcademy(await carregarCarteiraAcademy(supabase));
    // Início de cada período (mês atual, últimos 3 e 12 meses incluindo o atual), como em Vendas.
    const hoje = hojeLocal();
    const inicio = (meses: number) => {
      const [a, m] = hoje.split("-").map(Number);
      const d = new Date(a, m - meses, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    };
    return (
      <div className="flex flex-col gap-6">
        <PageHeader modulo="Comercial · Academy" titulo="Clientes" descricao="Compradores dos cursos do Footure Academy — pedidos de venda do Bling, do mais recente para o mais antigo." />
        {compradores.length === 0 ? (
          <div className="rounded-xl border border-gray5 bg-surface shadow-table">
            <EstadoVazio icone={MdSchool} titulo="Nenhum comprador ainda" descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral." />
          </div>
        ) : (
          <TabelaClientesAcademy compradores={compradores} inicios={{ mes: inicio(1), tri: inicio(3), "12m": inicio(12) }} />
        )}
      </div>
    );
  }
  const clientes = await listarClientesComContagemPedidos(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial"
        titulo="Clientes"
        descricao="Clubes e agentes com pedido de venda no Bling — a base oficial de razão social, CNPJ e endereço."
        acoes={
          <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
            <MdAdd className="size-[18px]" />
            Novo cliente
          </Button>
        }
      />

      {clientes.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdBusiness}
            titulo="Nenhum cliente importado ainda"
            descricao="Use “Sincronizar Bling” no card de Integrações da barra lateral para importar os clientes (pessoa jurídica com pedido de venda)."
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

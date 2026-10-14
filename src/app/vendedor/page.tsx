import Link from "next/link";
import { MdAdd } from "react-icons/md";
import { exigirPapel } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listarPedidosDeVenda } from "@/lib/pedidos/consultas";
import { abaValida } from "@/lib/pedidos/abas";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { ListaPedidos } from "@/components/pedido/lista-pedidos";

export default async function VendedorPage({ searchParams }: PageProps<"/vendedor">) {
  const sessao = await exigirPapel("vendedor");
  const { aba } = await searchParams;
  const supabase = await createClient();
  const pedidos = await listarPedidosDeVenda(supabase, { vendedorId: sessao.id });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial"
        titulo="Pedidos de venda"
        descricao="Pedidos aprovados seguem automaticamente para geração de contrato no jurídico."
        acoes={
          <Button nativeButton={false} render={<Link href="/vendedor/novo" />}>
            <MdAdd className="size-[18px]" />
            Novo pedido
          </Button>
        }
      />
      <ListaPedidos pedidos={pedidos} aba={abaValida(typeof aba === "string" ? aba : undefined, "todos")} caminho="/vendedor" />
    </div>
  );
}

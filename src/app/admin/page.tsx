import Link from "next/link";
import { MdAdd, MdError } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { listarPedidosDeVenda } from "@/lib/pedidos/consultas";
import { abaValida } from "@/lib/pedidos/abas";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { ListaPedidos } from "@/components/pedido/lista-pedidos";

// Diretoria: todos os pedidos de venda, abrindo na fila de aprovação.
export default async function AdminPedidosPage({ searchParams }: PageProps<"/admin">) {
  const { aba } = await searchParams;
  const supabase = await createClient();
  const pedidos = await listarPedidosDeVenda(supabase);
  const comFalhaNaGeracao = pedidos.filter((p) => p.status === "aprovado" && p.geracao_contrato_erro);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Comercial"
        titulo="Pedidos de venda"
        descricao="Aprove os pedidos enviados pelo comercial — o contrato é gerado automaticamente e segue para o jurídico."
        acoes={
          <Button nativeButton={false} render={<Link href="/vendedor/novo" />}>
            <MdAdd className="size-[18px]" />
            Novo pedido
          </Button>
        }
      />

      {comFalhaNaGeracao.map((p) => {
        const cliente = p.clientes as unknown as { razao_social: string } | null;
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-red/30 bg-dangerBg px-5 py-4 text-red">
            <MdError className="size-5 shrink-0" />
            <div className="flex min-w-[240px] flex-1 flex-col">
              <span className="font-bold">
                Falha ao gerar contrato — {cliente?.razao_social ?? "Cliente"} ({buscarPlanoPorKey(p.plano)?.canonical ?? p.plano})
              </span>
              <span className="text-sm">{p.geracao_contrato_erro}</span>
            </div>
            <Button size="sm" variant="white" nativeButton={false} render={<Link href={`/pedidos/${p.id}`} />}>
              Ver e tentar novamente
            </Button>
          </div>
        );
      })}

      <ListaPedidos pedidos={pedidos} aba={abaValida(typeof aba === "string" ? aba : undefined, "aprovacao")} caminho="/admin" />
    </div>
  );
}

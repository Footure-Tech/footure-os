import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { PageHeader } from "@/components/shell/page-header";
import {
  listarClientes,
  listarRepresentantesFooture,
  listarSignatariosDoCliente,
  listarUsuariosParaAtribuicaoVenda,
} from "@/lib/pedidos/consultas";
import { PedidoForm } from "@/components/pedido/pedido-form";

export default async function NovoPedidoPage() {
  const sessao = await exigirPapel("vendedor", "admin");
  const supabase = await createClient();
  const [clientes, representantesFooture, usuarios] = await Promise.all([
    listarClientes(supabase),
    listarRepresentantesFooture(supabase),
    listarUsuariosParaAtribuicaoVenda(supabase),
  ]);

  const signatariosPorCliente: Record<string, { id: string; nomeCompleto: string; email: string; cpf: string }[]> = {};
  await Promise.all(
    clientes.map(async (c) => {
      const signatarios = await listarSignatariosDoCliente(supabase, c.id);
      signatariosPorCliente[c.id] = signatarios.map((s) => ({
        id: s.id,
        nomeCompleto: s.nome_completo,
        email: s.email,
        cpf: s.cpf,
      }));
    }),
  );

  return (
    <div className="flex max-w-[1300px] flex-col gap-6">
      <PageHeader
        modulo="Comercial · Pedidos de venda"
        titulo="Novo pedido de venda"
        voltarHref={sessao.papel === "admin" ? "/admin" : "/vendedor"}
      />
      <PedidoForm
        clientes={clientes.map((c) => ({ id: c.id, tipo: c.tipo, razaoSocial: c.razao_social, cnpj: c.cnpj }))}
        signatariosPorCliente={signatariosPorCliente}
        representantesFooture={representantesFooture.map((r) => ({ id: r.id, nome: r.nome }))}
        usuarios={usuarios.map((u) => ({ id: u.user_id, nome: u.nome }))}
      />
    </div>
  );
}

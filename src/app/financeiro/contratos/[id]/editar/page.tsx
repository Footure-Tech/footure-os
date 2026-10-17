import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { carregarContrato } from "@/lib/financeiro/carteira";
import { listarUsuariosParaAtribuicaoVenda } from "@/lib/pedidos/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { PageHeader } from "@/components/shell/page-header";
import { FormDadosContrato } from "@/components/financeiro/form-dados-contrato";

// Editar dados do contrato (venda que veio do Bling): vigência, SDR/Closer e licenças.
export default async function EditarDadosContratoPage({ params }: PageProps<"/financeiro/contratos/[id]/editar">) {
  // Edição dos dados do contrato é só da Diretoria (o vendedor só consulta).
  await exigirPapel("admin");
  const { id } = await params;
  const blingPedidoId = Number(id);
  if (!Number.isSafeInteger(blingPedidoId)) notFound();

  const supabase = await createClient();
  const dados = await carregarContrato(supabase, blingPedidoId);
  if (!dados) notFound();

  // Pedido nascido na plataforma tem esses dados no próprio pedido — edita lá.
  const { data: vinculo } = await supabase.from("pedidos").select("id").eq("bling_pedido_id", String(blingPedidoId)).maybeSingle();
  if (vinculo) redirect(`/pedidos/${vinculo.id}`);

  const [{ data: equipe }, { data: licencas }, usuarios] = await Promise.all([
    supabase.from("contrato_equipe_bling").select("sdr_id, closer_id, tipo_venda, origem").eq("bling_pedido_id", blingPedidoId).maybeSingle(),
    supabase.from("contrato_licencas_bling").select("licencas_pagas, licencas_gratuitas, valor_licenca_adicional").eq("bling_pedido_id", blingPedidoId).maybeSingle(),
    listarUsuariosParaAtribuicaoVenda(supabase),
  ]);
  const { contrato } = dados;

  return (
    <div className="flex max-w-[1300px] flex-col gap-6">
      <PageHeader
        modulo="Financeiro · Contratos"
        titulo="Editar dados do contrato"
        descricao="Vigência, dados comerciais e licenças — informações que o Bling não guarda."
        voltarHref={`/financeiro/contratos/${blingPedidoId}`}
      />
      <FormDadosContrato
        usuarios={usuarios.map((u) => ({ id: u.user_id, nome: u.nome }))}
        dados={{
          blingPedidoId,
          numeroPedido: contrato.numeroPedido,
          cliente: contrato.cliente,
          logoUrl: urlLogoCliente(supabase, contrato.logoPath),
          valorTotal: contrato.valorTotal,
          dataVenda: contrato.dataVenda,
          inicio: contrato.inicio,
          fim: contrato.fim,
          vigenciaDefinida: contrato.vigenciaDefinida,
          sdrId: equipe?.sdr_id ?? null,
          closerId: equipe?.closer_id ?? null,
          tipoVenda: equipe?.tipo_venda ?? null,
          origem: equipe?.origem ?? null,
          licencasPagas: licencas?.licencas_pagas ?? null,
          licencasGratuitas: licencas?.licencas_gratuitas ?? null,
          valorLicencaAdicional: licencas?.valor_licenca_adicional === null || licencas?.valor_licenca_adicional === undefined ? null : Number(licencas.valor_licenca_adicional),
        }}
      />
    </div>
  );
}

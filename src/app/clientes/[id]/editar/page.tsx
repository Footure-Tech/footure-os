import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarCliente, listarContatosBlingSemCadastro, urlLogoCliente } from "@/lib/clientes/consultas";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { PageHeader } from "@/components/shell/page-header";

export default async function EditarClientePage({ params }: PageProps<"/clientes/[id]/editar">) {
  const { id } = await params;
  const supabase = await createClient();
  const cliente = await buscarCliente(supabase, id);
  if (!cliente) notFound();

  const logoUrl = urlLogoCliente(supabase, cliente.logo_path);
  // Legado sem bling_contato_id (nunca casou na sincronização automática,
  // ex.: CNPJ cadastrado errado) ainda precisa escolher um contato aqui.
  const contatosBling = cliente.bling_contato_id == null ? await listarContatosBlingSemCadastro(supabase) : [];

  return (
    <div className="flex max-w-[1300px] flex-col gap-6">
      <PageHeader modulo="Comercial · Clientes" titulo="Editar cliente" descricao="Perfil, endereço de contrato, foro e logo — a razão social e o CNPJ seguem o Bling." voltarHref={`/clientes/${cliente.id}`} />
      <ClienteForm
        cliente={{
          id: cliente.id,
          tipo: cliente.tipo,
          razaoSocial: cliente.razao_social,
          nomeFantasia: cliente.nome_fantasia,
          apelido: cliente.apelido,
          cnpj: cliente.cnpj,
          endereco: cliente.endereco,
          numero: cliente.numero,
          complemento: cliente.complemento,
          bairro: cliente.bairro,
          cep: cliente.cep,
          municipio: cliente.municipio,
          uf: cliente.uf,
          enderecoLegado: cliente.endereco_legado,
          foroPreferencial: cliente.foro_preferencial,
          logoUrl,
          blingContatoId: cliente.bling_contato_id,
        }}
        contatosBling={contatosBling}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { listarContatosBlingSemCadastro } from "@/lib/clientes/consultas";
import { buscarDetalheContatoBling } from "@/lib/integracoes/bling";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { PageHeader } from "@/components/shell/page-header";

export default async function NovoClientePage({ searchParams }: PageProps<"/clientes/novo">) {
  const { blingContatoId } = await searchParams;
  const supabase = await createClient();
  const contatosBling = await listarContatosBlingSemCadastro(supabase);

  const idInicial = typeof blingContatoId === "string" ? Number(blingContatoId) : undefined;
  // Pré-preenche nome fantasia/endereço com o que já existe no Bling, pra não
  // digitar de novo o que a fonte oficial já tem — segue editável/salvável
  // normalmente, isso é só o valor padrão.
  const detalheBling = idInicial ? await buscarDetalheContatoBling(supabase, idInicial) : null;

  return (
    <div className="flex max-w-[1300px] flex-col gap-6">
      <PageHeader modulo="Comercial · Clientes" titulo="Novo cliente" descricao="Escolha o contato do Bling e complete os dados usados nos pedidos e contratos." voltarHref={"/clientes"} />
      <ClienteForm contatosBling={contatosBling} blingContatoIdInicial={idInicial} valoresIniciaisBling={detalheBling} />
    </div>
  );
}

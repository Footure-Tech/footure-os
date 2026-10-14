import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoCliente } from "@/lib/supabase/database.types";
import { calcularSituacaoCliente, type SituacaoCliente } from "@/lib/clientes/situacao";

type Supa = SupabaseClient<Database>;

function logSeErro(contexto: string, error: { message: string } | null) {
  if (error) console.error(`[clientes/consultas] ${contexto}:`, error.message);
}

export interface ClienteListado {
  blingContatoId: number;
  clienteId: string | null;
  razaoSocial: string;
  cnpj: string;
  nomeFantasia: string | null;
  tipo: TipoCliente | null;
  foroPreferencial: string | null;
  logoPath: string | null;
  cadastradoNoSistema: boolean;
  /** Pedidos LOCAIS (nosso processo de venda) — só pra travar exclusão, nunca exibido na lista. */
  totalPedidosLocais: number;
  totalParcelas: number;
  parcelasEmitidas: number;
  parcelasAtrasadas: number;
  situacao: SituacaoCliente;
}

/**
 * O Bling é a base de identidade (razão social/CNPJ) — a lista parte do
 * cache local bling_contatos (sincronizado sob demanda, ver
 * sincronizarContatosBling) e completa com o complemento local (logo,
 * perfil, endereço, foro, pedidos) quando o contato já tem cadastro aqui.
 * Contato sem complemento aparece mesmo assim, só sem esses dados extras.
 *
 * Parcelas emitidas/atrasadas e situação vêm do resumo já calculado em
 * bling_contatos na sincronização, não de uma chamada ao vivo — com 100+
 * clientes reais, checar cada um na hora de abrir a lista estouraria o
 * limite de 3 req/s do Bling e deixaria a tela muito lenta.
 */
export async function listarClientesComContagemPedidos(supabase: Supa): Promise<ClienteListado[]> {
  const [{ data: contatosBling, error: erroContatos }, { data: clientesLocais, error: erroClientes }, { data: pedidos, error: erroPedidos }] =
    await Promise.all([
      supabase.from("bling_contatos").select("*").order("nome", { ascending: true }),
      supabase.from("clientes").select("*"),
      supabase.from("pedidos").select("cliente_id, status, vigencia_inicio, vigencia_fim, criado_em"),
    ]);
  logSeErro("listarClientesComContagemPedidos:contatosBling", erroContatos);
  logSeErro("listarClientesComContagemPedidos:clientes", erroClientes);
  logSeErro("listarClientesComContagemPedidos:pedidos", erroPedidos);

  const clientesPorBlingId = new Map((clientesLocais ?? []).filter((c) => c.bling_contato_id != null).map((c) => [c.bling_contato_id!, c]));

  const pedidosPorCliente = new Map<string, NonNullable<typeof pedidos>>();
  for (const p of pedidos ?? []) {
    const lista = pedidosPorCliente.get(p.cliente_id) ?? [];
    lista.push(p);
    pedidosPorCliente.set(p.cliente_id, lista);
  }

  return (contatosBling ?? []).map((contato) => {
    const clienteLocal = clientesPorBlingId.get(contato.id) ?? null;
    const pedidosDoCliente = clienteLocal ? (pedidosPorCliente.get(clienteLocal.id) ?? []) : [];
    const { situacao } = calcularSituacaoCliente(
      pedidosDoCliente,
      contato.tem_parcela_atrasada,
      contato.tem_parcela_a_vencer,
      contato.total_pedidos_venda,
    );
    return {
      blingContatoId: contato.id,
      clienteId: clienteLocal?.id ?? null,
      razaoSocial: clienteLocal?.razao_social ?? contato.nome,
      cnpj: clienteLocal?.cnpj ?? contato.cnpj,
      nomeFantasia: clienteLocal?.nome_fantasia ?? null,
      tipo: clienteLocal?.tipo ?? null,
      foroPreferencial: clienteLocal?.foro_preferencial ?? null,
      logoPath: clienteLocal?.logo_path ?? null,
      cadastradoNoSistema: !!clienteLocal,
      totalPedidosLocais: pedidosDoCliente.length,
      totalParcelas: contato.total_parcelas,
      parcelasEmitidas: contato.parcelas_emitidas,
      parcelasAtrasadas: contato.parcelas_atrasadas,
      situacao,
    };
  });
}

/** Contatos do Bling (cache local) que ainda não têm um cliente local
 * vinculado — candidatos válidos pro seletor de "novo cliente" ou pra religar
 * um cliente legado sem bling_contato_id (ex.: CNPJ cadastrado errado, nunca
 * casou na sincronização automática). */
export async function listarContatosBlingSemCadastro(supabase: Supa) {
  const [{ data: contatos, error: erroContatos }, { data: clientesLocais, error: erroClientes }] = await Promise.all([
    supabase.from("bling_contatos").select("id, nome, cnpj").order("nome", { ascending: true }),
    supabase.from("clientes").select("bling_contato_id").not("bling_contato_id", "is", null),
  ]);
  logSeErro("listarContatosBlingSemCadastro:contatos", erroContatos);
  logSeErro("listarContatosBlingSemCadastro:clientes", erroClientes);

  const vinculados = new Set((clientesLocais ?? []).map((c) => c.bling_contato_id));
  return (contatos ?? []).filter((c) => !vinculados.has(c.id));
}

export async function buscarCliente(supabase: Supa, clienteId: string) {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).single();
  logSeErro(`buscarCliente(${clienteId})`, error);
  return data ?? null;
}

/** getPublicUrl é síncrono (só monta a URL) — o bucket `logos-clientes` é público. */
export function urlLogoCliente(supabase: Supa, logoPath: string | null): string | null {
  if (!logoPath) return null;
  return supabase.storage.from("logos-clientes").getPublicUrl(logoPath).data.publicUrl;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoCliente } from "@/lib/supabase/database.types";
import { calcularSituacaoCliente, type SituacaoCliente } from "@/lib/clientes/situacao";
import { pedidoBlingCancelado } from "@/lib/integracoes/bling";
import { hojeLocal } from "@/lib/financeiro/carteira";

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
/** Contatos do Bling com algum contrato (pedido de venda não cancelado) cuja
 * vigência informada na plataforma (0034) ainda não terminou. */
async function contatosComVigenciaBlingEmCurso(supabase: Supa): Promise<Set<number>> {
  const hoje = hojeLocal();
  const { data: vigentes, error } = await supabase.from("contrato_vigencia_bling").select("bling_pedido_id").gte("vigencia_fim", hoje);
  logSeErro("contatosComVigenciaBlingEmCurso", error);
  if (!vigentes?.length) return new Set();
  const { data: pedidos } = await supabase
    .from("bling_pedidos")
    .select("contato_id, situacao_id, situacao_valor")
    .in("id", vigentes.map((v) => v.bling_pedido_id));
  return new Set((pedidos ?? []).filter((p) => !pedidoBlingCancelado(p.situacao_id, p.situacao_valor)).map((p) => p.contato_id));
}

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

  const contatosComContratoVigente = await contatosComVigenciaBlingEmCurso(supabase);
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
      contatosComContratoVigente.has(contato.id),
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

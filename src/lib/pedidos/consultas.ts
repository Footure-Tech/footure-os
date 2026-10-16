// Consultas de leitura reaproveitadas pelas telas — cada uma já reflete a
// visibilidade da RLS (o `supabase` passado é sempre o client autenticado da
// request, nunca service role).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

// Erros de consulta (relacionamento não encontrado, RLS negando, etc.) não
// devem virar "lista vazia"/"não encontrado" silencioso — isso já custou um
// bug real (FK faltando pro embed de profiles) que parecia rota quebrada.
function logSeErro(contexto: string, error: { message: string } | null) {
  if (error) console.error(`[consultas] ${contexto}:`, error.message);
}

/** Lista de "Pedidos de venda" (redesign): colunas de pagamento e vendedor
 * inclusas. Sem filtro de vendedor — a RLS já restringe o vendedor aos
 * próprios pedidos; admin/jurídico enxergam todos. */
export async function listarPedidosDeVenda(supabase: Supa, filtro?: { vendedorId?: string }) {
  let consulta = supabase
    .from("pedidos")
    .select(
      "id, status, perfil, plano, valor_total, forma_pagamento, meio_pagamento, numero_parcelas, geracao_contrato_erro, bling_pedido_id, criado_em, clientes(razao_social, nome_fantasia, logo_path), profiles!pedidos_vendedor_id_profiles_fkey(nome)",
    )
    .order("criado_em", { ascending: false });
  if (filtro?.vendedorId) consulta = consulta.eq("vendedor_id", filtro.vendedorId);
  const { data, error } = await consulta;
  logSeErro("listarPedidosDeVenda", error);
  return data ?? [];
}

/** Tela Contratos (jurídico): pedidos da geração do contrato em diante, com
 * todas as versões do contrato (a mais recente é escolhida por quem chama). */
export async function listarContratosJuridico(supabase: Supa) {
  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "id, status, perfil, plano, valor_total, geracao_contrato_erro, criado_em, bling_pedido_numero, clientes(razao_social, nome_fantasia, logo_path), profiles!pedidos_vendedor_id_profiles_fkey(nome), contratos(id, versao, gerado_em, assinatura_incompleta)",
    )
    .in("status", ["aprovado", "em_revisao_juridica", "pronto_para_assinatura", "enviado_para_assinatura", "assinado", "concluido"])
    // Pedido sem contrato (0040) não passa pelo jurídico.
    .eq("gera_contrato", true)
    .order("atualizado_em", { ascending: false });
  logSeErro("listarContratosJuridico", error);
  return data ?? [];
}

export async function buscarPedidoDetalhe(supabase: Supa, pedidoId: string) {
  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .select(
      "*, clientes(*), profiles!pedidos_vendedor_id_profiles_fkey(nome), sdr:profiles!pedidos_sdr_id_fkey(nome), closer:profiles!pedidos_closer_id_fkey(nome)",
    )
    .eq("id", pedidoId)
    .single();
  logSeErro(`buscarPedidoDetalhe(${pedidoId})`, erroPedido);
  if (!pedido) return null;

  const [
    { data: transicoes, error: erroTransicoes },
    { data: contratos, error: erroContratos },
    { data: signatarios, error: erroSignatarios },
    { data: repsFooture, error: erroReps },
    { data: testFooture, error: erroTest },
  ] = await Promise.all([
    supabase
      .from("transicoes")
      .select("id, de, para, comentario, criado_em, profiles(nome)")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: true }),
    supabase.from("contratos").select("*").eq("pedido_id", pedidoId).order("versao", { ascending: false }),
    supabase
      .from("pedido_signatarios")
      .select("tipo, signatarios_cliente(id, nome_completo, email, cpf)")
      .eq("pedido_id", pedidoId),
    supabase.from("pedido_representantes_footure").select("representantes_footure(id, nome, email, cpf)").eq("pedido_id", pedidoId),
    supabase.from("pedido_testemunhas_footure").select("*").eq("pedido_id", pedidoId),
  ]);
  logSeErro("buscarPedidoDetalhe:transicoes", erroTransicoes);
  logSeErro("buscarPedidoDetalhe:contratos", erroContratos);
  logSeErro("buscarPedidoDetalhe:signatarios", erroSignatarios);
  logSeErro("buscarPedidoDetalhe:representantesFooture", erroReps);
  logSeErro("buscarPedidoDetalhe:testemunhasFooture", erroTest);

  return {
    pedido,
    transicoes: transicoes ?? [],
    contratos: contratos ?? [],
    signatarios: signatarios ?? [],
    representantesFooture: repsFooture ?? [],
    testemunhasFooture: testFooture ?? [],
  };
}

export async function listarPedidosDoCliente(supabase: Supa, clienteId: string) {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, status, plano, valor_mensal, valor_total, vigencia_inicio, vigencia_fim, criado_em")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });
  logSeErro(`listarPedidosDoCliente(${clienteId})`, error);
  return data ?? [];
}

export async function listarClientes(supabase: Supa) {
  const { data, error } = await supabase.from("clientes").select("*").order("razao_social", { ascending: true });
  logSeErro("listarClientes", error);
  return data ?? [];
}

export async function listarSignatariosDoCliente(supabase: Supa, clienteId: string) {
  const { data, error } = await supabase
    .from("signatarios_cliente")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });
  logSeErro("listarSignatariosDoCliente", error);
  return data ?? [];
}

export async function listarRepresentantesFooture(supabase: Supa) {
  const { data, error } = await supabase.from("representantes_footure").select("*").eq("ativo", true).order("nome");
  logSeErro("listarRepresentantesFooture", error);
  return data ?? [];
}

export async function listarUsuarios(supabase: Supa) {
  const { data, error } = await supabase.from("profiles").select("*").order("nome");
  logSeErro("listarUsuarios", error);
  return data ?? [];
}

// SDR e Closer do pedido podem ser qualquer vendedor ou admin (não só quem
// tem o pedido) — jurídico fica de fora, não faz sentido pra atribuição de venda.
export async function listarUsuariosParaAtribuicaoVenda(supabase: Supa) {
  const { data, error } = await supabase.from("profiles").select("*").in("papel", ["vendedor", "admin"]).order("nome");
  logSeErro("listarUsuariosParaAtribuicaoVenda", error);
  return data ?? [];
}

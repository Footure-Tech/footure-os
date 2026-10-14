// Monta o objeto DadosContrato (gerarContrato.ts) a partir das tabelas do
// pedido — o "monte um objeto de dados normalizado" que o PROMPT.md (6.4)
// pede pra API route fazer antes de chamar o gerador.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DadosContrato, Signatario } from "./gerarContrato";
import { montarFeatures } from "./planos";
import { buscarPlanoPorKey, tierDaKey } from "@/lib/plans/normalize";
import { gerarParcelas } from "./parcelas";
import { valorFormatadoComExtenso, formatarMoeda } from "./valorPorExtenso";
import { FORO_DEFAULT } from "@/lib/validacoes/pedido";
import { formatarEnderecoCliente } from "@/lib/clientes/formatacao";

type Supa = SupabaseClient<Database>;

export async function montarDadosContrato(supabase: Supa, pedidoId: string): Promise<DadosContrato> {
  const { data: pedido, error: erroPedido } = await supabase.from("pedidos").select("*").eq("id", pedidoId).single();
  if (erroPedido || !pedido) throw new Error(`Pedido ${pedidoId} não encontrado: ${erroPedido?.message}`);

  const { data: cliente, error: erroCliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", pedido.cliente_id)
    .single();
  if (erroCliente || !cliente) throw new Error(`Cliente ${pedido.cliente_id} não encontrado: ${erroCliente?.message}`);

  const [{ data: pedidoSignatarios }, { data: pedidoRepsFooture }, { data: testemunhasFooture }] = await Promise.all([
    supabase
      .from("pedido_signatarios")
      .select("tipo, signatarios_cliente(nome_completo, email, cpf)")
      .eq("pedido_id", pedidoId),
    supabase.from("pedido_representantes_footure").select("representantes_footure(nome)").eq("pedido_id", pedidoId),
    supabase.from("pedido_testemunhas_footure").select("nome_completo, email, cpf").eq("pedido_id", pedidoId),
  ]);

  const paraSignatario = (row: { nome_completo: string; email: string; cpf: string }): Signatario => ({
    nomeCompleto: row.nome_completo,
    email: row.email,
    cpf: row.cpf,
  });

  const representantesContratante: Signatario[] = (pedidoSignatarios ?? [])
    .filter((r) => r.tipo === "representante_legal" && r.signatarios_cliente)
    .map((r) => paraSignatario(r.signatarios_cliente as unknown as { nome_completo: string; email: string; cpf: string }));

  const testemunhasContratante: Signatario[] = (pedidoSignatarios ?? [])
    .filter((r) => r.tipo === "testemunha" && r.signatarios_cliente)
    .map((r) => paraSignatario(r.signatarios_cliente as unknown as { nome_completo: string; email: string; cpf: string }));

  const representantesFooture = (pedidoRepsFooture ?? [])
    .map((r) => r.representantes_footure as unknown as { nome: string } | null)
    .filter((r): r is { nome: string } => !!r)
    .map((r) => ({ nome: r.nome }));

  // pedido.plano guarda a key canônica (ex.: "clube:scout-essential") — resolve pro
  // nome do tier (FEATURES_CLUBE/FEATURES_AGENTE continuam indexadas por tier puro)
  // e pro rótulo "Scout X" já pronto pra imprimir (registro é a fonte única).
  const planoCanonico = buscarPlanoPorKey(pedido.plano);
  const tier = tierDaKey(pedido.plano);
  if (!planoCanonico || !tier) {
    throw new Error(`Plano "${pedido.plano}" não encontrado no registro canônico (plan-registry.json).`);
  }

  const features = montarFeatures(
    pedido.perfil,
    tier,
    pedido.produtos.includes("api"),
    pedido.licencas_pagas,
    pedido.licencas_gratuitas,
  );

  const parcelas =
    pedido.forma_pagamento === "parcelado"
      ? gerarParcelas(formatarDDMMAAAA(pedido.primeiro_pagamento), pedido.numero_parcelas ?? 12, pedido.convencao_parcelas)
      : [];

  return {
    perfil: pedido.perfil,
    robusta: pedido.robusta,
    cliente: cliente.razao_social,
    cnpj: cliente.cnpj,
    endereco: formatarEnderecoCliente(cliente),
    representantesContratante,
    testemunhasContratante,
    representantesFooture,
    testemunhasFooture: (testemunhasFooture ?? []).map(paraSignatario),
    plano: planoCanonico.canonical,
    api: pedido.produtos.includes("api"),
    apiModelo: pedido.api_modelo ?? undefined,
    pagamento: pedido.forma_pagamento,
    metodo: pedido.meio_pagamento === "pix" ? "pix" : "boleto",
    total: valorFormatadoComExtenso(pedido.valor_total),
    mensal: valorFormatadoComExtenso(pedido.valor_mensal),
    mensalApi: pedido.valor_mensal_api != null ? valorFormatadoComExtenso(pedido.valor_mensal_api) : undefined,
    mensalSoftware:
      pedido.valor_mensal_software != null ? valorFormatadoComExtenso(pedido.valor_mensal_software) : undefined,
    licAdicional: pedido.valor_licenca_adicional != null ? formatarMoeda(pedido.valor_licenca_adicional) : "a combinar",
    diaVenc: pedido.dia_vencimento != null ? String(pedido.dia_vencimento) : undefined,
    numeroParcelas: pedido.numero_parcelas ?? undefined,
    primeiroVenc: formatarDDMMAAAA(pedido.primeiro_pagamento),
    vencAvista: undefined,
    vigIni: formatarDDMMAAAA(pedido.vigencia_inicio),
    vigFim: formatarDDMMAAAA(pedido.vigencia_fim),
    divulgacao: pedido.divulgacao,
    percentualDesconto: pedido.percentual_desconto_divulgacao ?? undefined,
    postDivulgacao: pedido.post_divulgacao ?? undefined,
    foro: pedido.foro || FORO_DEFAULT,
    multaTexto: pedido.multa_texto,
    features,
    parcelas,
    dataGeracao: new Date(),
  };
}

// pedidos.primeiro_pagamento etc. são `date` do Postgres (formato YYYY-MM-DD
// vindo do supabase-js) — o gerador espera DD/MM/AAAA (mesmo formato do
// scripts/parcelas.py original).
function formatarDDMMAAAA(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

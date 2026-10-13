// Fase 2 (PROMPT.md 7.1) — integração com o Bling (API v3, OAuth 2.0,
// developer.bling.com.br).
//
// OAuth (implementado agora): GET /Api/v3/oauth/authorize (login do usuário,
// host bling.com.br, NÃO api.bling.com.br) -> rota de callback troca o code
// por tokens via POST api.bling.com.br/Api/v3/oauth/token (Basic auth com
// client_id:client_secret em base64) -> guarda em integracoes_bling. Access
// token dura 6h; refresh_token dura 30 dias — obterAccessTokenValido()
// renova automaticamente quando necessário.
//
// POST /pedidos/vendas (ainda NÃO implementado): montarPayloadBling já
// esboça o mapeamento de campos, mas criarPedidoBling continua sendo um stub
// documentado até confirmar o formato exato do payload com a doc/exemplos.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";

type Supa = SupabaseClient<Database>;
type PedidoRow = Database["public"]["Tables"]["pedidos"]["Row"];

const AUTORIZACAO_URL = "https://bling.com.br/Api/v3/oauth/authorize";
const TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

function credenciaisBasicAuth(): string {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("BLING_CLIENT_ID / BLING_CLIENT_SECRET não configurados.");
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

/** redirect_uri e scope NÃO vão na URL — a doc do Bling diz que esses dois
 * sempre usam o valor cadastrado no app, mesmo se informados na requisição. */
export function gerarUrlAutorizacaoBling(state: string): string {
  const clientId = process.env.BLING_CLIENT_ID;
  if (!clientId) throw new Error("BLING_CLIENT_ID não configurado.");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, state });
  return `${AUTORIZACAO_URL}?${params.toString()}`;
}

interface TokensBling {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

async function chamarTokenEndpoint(corpo: Record<string, string>): Promise<TokensBling> {
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
      Authorization: `Basic ${credenciaisBasicAuth()}`,
    },
    body: new URLSearchParams(corpo).toString(),
  });
  const json = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(`Bling oauth/token retornou ${resposta.status}: ${JSON.stringify(json)}`);
  }
  return json as TokensBling;
}

async function salvarTokens(supabase: Supa, tokens: TokensBling): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const linha = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    config: { scope: tokens.scope, token_type: tokens.token_type },
  };

  // Singleton (uma conexão Bling só, pra conta inteira) — sem linha
  // pré-criada por migration (ao contrário de configuracoes_comissionamento),
  // então faz upsert manual: atualiza se já existir, senão insere.
  const { data: existente } = await supabase.from("integracoes_bling").select("id").limit(1).maybeSingle();
  if (existente) {
    const { error } = await supabase.from("integracoes_bling").update(linha).eq("id", existente.id);
    if (error) throw new Error(`Falha ao salvar tokens do Bling: ${error.message}`);
  } else {
    const { error } = await supabase.from("integracoes_bling").insert(linha);
    if (error) throw new Error(`Falha ao salvar tokens do Bling: ${error.message}`);
  }
}

/** Chamado pela rota de callback depois do usuário autorizar o app no Bling. */
export async function trocarCodigoPorToken(supabase: Supa, code: string): Promise<void> {
  const tokens = await chamarTokenEndpoint({ grant_type: "authorization_code", code });
  await salvarTokens(supabase, tokens);
}

/** Busca um access_token válido pra chamar a API, renovando via
 * refresh_token automaticamente quando já expirou (margem de 60s). Ainda sem
 * uso — fica pronta pra quando POST /pedidos/vendas for implementado. */
export async function obterAccessTokenValido(supabase: Supa): Promise<string> {
  const { data, error } = await supabase.from("integracoes_bling").select("*").limit(1).maybeSingle();
  if (error || !data?.access_token) {
    throw new Error("Bling não conectado — conecte em /admin/configuracoes antes de usar a integração.");
  }

  const expiraEm = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (Date.now() < expiraEm - 60_000) {
    return data.access_token;
  }

  if (!data.refresh_token) {
    throw new Error("Token do Bling expirado e sem refresh_token salvo — reconecte em /admin/configuracoes.");
  }
  const tokens = await chamarTokenEndpoint({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  await salvarTokens(supabase, tokens);
  return tokens.access_token;
}

/** Status pra exibir em /admin/configuracoes. */
export async function buscarStatusBling(supabase: Supa) {
  const { data } = await supabase.from("integracoes_bling").select("expires_at, atualizado_em").limit(1).maybeSingle();
  return { conectado: !!data, expiresAt: data?.expires_at ?? null, atualizadoEm: data?.atualizado_em ?? null };
}

export interface PedidoVendaBling {
  numero?: string;
  data: string;
  itens: Array<{ descricao: string; quantidade: number; valor: number }>;
  observacoes?: string;
}

/**
 * Mapeia um pedido do sistema para o payload de POST /pedidos/vendas do
 * Bling — chamado quando o pedido chega a APROVADO (PROMPT.md 7.1).
 * NÃO chama a API ainda: retorna o payload esboçado e loga a intenção.
 */
export function montarPayloadBling(pedido: PedidoRow): PedidoVendaBling {
  return {
    data: pedido.criado_em.slice(0, 10),
    itens: [
      {
        descricao: `Assinatura Footlink — Plano ${buscarPlanoPorKey(pedido.plano)?.canonical ?? pedido.plano}`,
        quantidade: pedido.licencas_pagas,
        valor: pedido.valor_mensal,
      },
      ...(pedido.produtos.includes("api") && pedido.valor_mensal_api != null
        ? [{ descricao: "API Footlink", quantidade: 1, valor: pedido.valor_mensal_api }]
        : []),
    ],
    observacoes: pedido.condicao_especial ?? undefined,
  };
}

/** Stub — POST /pedidos/vendas ainda não implementado (falta confirmar o
 * formato exato do payload). OAuth (acima) já é real; usar
 * obterAccessTokenValido(supabase) aqui quando essa parte for implementada. */
export async function criarPedidoBling(pedido: PedidoRow): Promise<{ blingPedidoId: string | null }> {
  const payload = montarPayloadBling(pedido);
  console.info("[stub] criarPedidoBling — POST /pedidos/vendas ainda não implementado. Payload que seria enviado:", payload);
  return { blingPedidoId: null };
}

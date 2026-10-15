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

const API_BASE = "https://api.bling.com.br/Api/v3";

// Bling limita a 3 requisições/segundo por aplicativo — telas como a lista de
// clientes disparam várias chamadas em paralelo (uma por cliente), então todo
// GET passa por essa fila, que serializa com um intervalo mínimo entre
// chamadas (processo único do servidor Next, suficiente pro volume atual).
const INTERVALO_MIN_MS = 350;
let proximoHorarioLivre = 0;

function aguardarVezNaFila(): Promise<void> {
  const agora = Date.now();
  const inicio = Math.max(agora, proximoHorarioLivre);
  proximoHorarioLivre = inicio + INTERVALO_MIN_MS;
  const espera = inicio - agora;
  return espera > 0 ? new Promise((resolve) => setTimeout(resolve, espera)) : Promise.resolve();
}

async function chamarApiBling<T>(token: string, caminho: string, tentativa = 0): Promise<T> {
  await aguardarVezNaFila();
  const resposta = await fetch(`${API_BASE}${caminho}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await resposta.json().catch(() => null);
  if (resposta.status === 429 && tentativa < 2) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return chamarApiBling<T>(token, caminho, tentativa + 1);
  }
  if (!resposta.ok) throw new Error(`Bling ${caminho} retornou ${resposta.status}: ${JSON.stringify(json)}`);
  return json as T;
}

export interface ParcelaBling {
  id: number;
  vencimento: string;
  valor: number;
  situacao: number;
}

export interface PedidoVendaBlingResumo {
  id: number;
  numero: number;
  data: string;
  total: number;
  descricaoItens: string;
  parcelas: ParcelaBling[];
}

export interface VisaoBlingCliente {
  conectado: boolean;
  contatoEncontrado: boolean;
  pedidos: PedidoVendaBlingResumo[];
}

/** Não existe hoje vínculo gravado (bling_pedido_id nunca é preenchido —
 * criarPedidoBling ainda é stub), então o cruzamento é sempre por CNPJ. */
async function buscarContatoBling(token: string, cnpj: string): Promise<{ id: number; nome: string } | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  const contatos = await chamarApiBling<{ data: Array<{ id: number; nome: string }> }>(
    token,
    `/contatos?numeroDocumento=${cnpjLimpo}`,
  );
  return contatos.data?.[0] ?? null;
}

async function buscarIdContatoBling(token: string, cnpj: string): Promise<number | null> {
  const contato = await buscarContatoBling(token, cnpj);
  return contato?.id ?? null;
}

/**
 * Sincroniza o cache local bling_contatos com os contatos pessoa jurídica
 * (CNPJ, 14 dígitos) do Bling. Disparado sob demanda (botão em /clientes) —
 * a API do Bling não tem filtro server-side por tipo de pessoa e a conta tem
 * 2000+ contatos (maioria pessoa física, de outro produto), então buscar ao
 * vivo a cada carregamento da tela seria inviável.
 *
 * Também religa automaticamente qualquer cliente local ainda sem
 * bling_contato_id, por CNPJ — cobre tanto a migração inicial dos clientes
 * já cadastrados quanto o caso de alguém digitar o CNPJ errado e corrigir
 * depois.
 */
/** limite=100: cobre o volume real visto até agora (nenhum cliente com mais
 * de 1 dígito de pedidos de venda); se algum dia passar disso o total fica
 * só truncado em 100, não quebra nada. */
async function buscarTotalPedidosVenda(token: string, idContato: number): Promise<number> {
  const resp = await chamarApiBling<{ data: Array<{ id: number }> }>(token, `/pedidos/vendas?idContato=${idContato}&limite=100`);
  return (resp.data ?? []).length;
}

export async function sincronizarContatosBling(
  supabase: Supa,
): Promise<{ totalContatos: number; novosClientesRegistrados: number; baixasImportadas: number }> {
  const token = await obterAccessTokenValido(supabase);
  const inicioSincronizacao = new Date().toISOString();

  const candidatosPessoaJuridica: Array<{ id: number; nome: string; cnpj: string; telefone: string | null }> = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const resp = await chamarApiBling<{
      data: Array<{ id: number; nome: string; numeroDocumento: string; telefone?: string; celular?: string }>;
    }>(token, `/contatos?pagina=${pagina}&limite=100`);
    const lista = resp.data ?? [];
    if (lista.length === 0) break;
    for (const c of lista) {
      const cnpjLimpo = c.numeroDocumento?.replace(/\D/g, "") ?? "";
      if (cnpjLimpo.length === 14) {
        candidatosPessoaJuridica.push({ id: c.id, nome: c.nome, cnpj: cnpjLimpo, telefone: c.celular || c.telefone || null });
      }
    }
  }

  // Essa conta do Bling é o financeiro inteiro da Footure, não só do
  // Footlink — pessoa jurídica sozinho ainda inclui fornecedor/prestador de
  // serviço (ex.: Google, Amazon, escritórios de advocacia). Só entra quem
  // de fato tem pedido de venda: fornecedor nunca aparece como contato de um
  // pedido de venda (a relação é invertida — a Footure paga eles, não vende
  // pra eles). Já aproveita essa mesma chamada pra guardar o total de
  // pedidos — é exibido na lista de clientes, que antes só contava pedido
  // LOCAL (nosso processo de venda) e ficava zerada pra quase todo cliente
  // real, já que a maioria nunca passou pelo nosso fluxo. Checagem
  // sequencial (não paralela) pelo mesmo motivo do resto do arquivo: evita
  // saturar o limite de 3 req/s do Bling.
  const contatosPessoaJuridica: Array<
    (typeof candidatosPessoaJuridica)[number] & {
      totalPedidosVenda: number;
      temParcelaAtrasada: boolean;
      temParcelaAVencer: boolean;
      totalParcelas: number;
      parcelasEmitidas: number;
      parcelasAtrasadas: number;
    }
  > = [];
  // Parcelas de cada contato qualificado — vão pro cache bling_parcelas (0030).
  const parcelasParaCache: Array<{ id: number; contato_id: number; numero_pedido_origem: string | null; vencimento: string; valor: number; situacao: number }> = [];
  const hoje = new Date().toISOString().slice(0, 10);
  for (const candidato of candidatosPessoaJuridica) {
    const totalPedidosVenda = await buscarTotalPedidosVenda(token, candidato.id);
    if (totalPedidosVenda === 0) continue;
    const parcelas = await buscarContasReceberBling(token, candidato.id);
    for (const p of parcelas) {
      parcelasParaCache.push({
        id: p.id,
        contato_id: candidato.id,
        numero_pedido_origem: p.numeroPedidoOrigem,
        vencimento: p.vencimento,
        valor: p.valor,
        situacao: p.situacao,
      });
    }
    const classificacoes = parcelas.map((p) => classificarSituacaoParcela(p.situacao, p.vencimento));
    const parcelasAtrasadas = classificacoes.filter((c) => c === "atrasada").length;
    const temParcelaAtrasada = parcelasAtrasadas > 0;
    // "Em dia" só faz sentido com parcela futura em aberto — sem isso
    // (tudo já recebido, ou pedido antigo sem parcela nenhuma pendente), o
    // cliente está de fato inativo, mesmo sem nenhuma atrasada.
    const temParcelaAVencer = classificacoes.includes("em_aberto");
    // "Emitida" = já passou do vencimento, paga ou não (contraste com "a
    // vencer", que é só o que ainda não chegou na data) — é o que a
    // listagem mostra como "X de Y parcelas".
    const parcelasEmitidas = parcelas.filter((p) => p.vencimento <= hoje).length;
    contatosPessoaJuridica.push({
      ...candidato,
      totalPedidosVenda,
      temParcelaAtrasada,
      temParcelaAVencer,
      totalParcelas: parcelas.length,
      parcelasEmitidas,
      parcelasAtrasadas,
    });
  }

  if (contatosPessoaJuridica.length > 0) {
    const { error } = await supabase.from("bling_contatos").upsert(
      contatosPessoaJuridica.map((c) => ({
        id: c.id,
        nome: c.nome,
        cnpj: c.cnpj,
        telefone: c.telefone,
        total_pedidos_venda: c.totalPedidosVenda,
        tem_parcela_atrasada: c.temParcelaAtrasada,
        tem_parcela_a_vencer: c.temParcelaAVencer,
        total_parcelas: c.totalParcelas,
        parcelas_emitidas: c.parcelasEmitidas,
        parcelas_atrasadas: c.parcelasAtrasadas,
        sincronizado_em: new Date().toISOString(),
      })),
    );
    if (error) throw new Error(`Falha ao salvar cache de contatos do Bling: ${error.message}`);
  }

  const baixasImportadas = await salvarCacheParcelas(supabase, parcelasParaCache, inicioSincronizacao);

  // Remove do cache quem não qualifica mais (ex.: era fornecedor que tinha
  // ficado antes dessa checagem existir) — nunca quem ainda está vinculado a
  // um cliente local, pra não violar a FK.
  const { data: contatosEmCache } = await supabase.from("bling_contatos").select("id");
  const { data: clientesVinculados } = await supabase.from("clientes").select("bling_contato_id").not("bling_contato_id", "is", null);
  const idsVinculados = new Set((clientesVinculados ?? []).map((c) => c.bling_contato_id));
  const idsQualificados = new Set(contatosPessoaJuridica.map((c) => c.id));
  const idsParaRemover = (contatosEmCache ?? [])
    .map((c) => c.id)
    .filter((id) => !idsQualificados.has(id) && !idsVinculados.has(id));
  if (idsParaRemover.length > 0) {
    await supabase.from("bling_contatos").delete().in("id", idsParaRemover);
  }

  const { data: clientesSemVinculo } = await supabase.from("clientes").select("id, cnpj").is("bling_contato_id", null);
  for (const cliente of clientesSemVinculo ?? []) {
    const cnpjLimpo = cliente.cnpj.replace(/\D/g, "");
    const match = contatosPessoaJuridica.find((c) => c.cnpj === cnpjLimpo);
    if (match) await supabase.from("clientes").update({ bling_contato_id: match.id }).eq("id", cliente.id);
  }

  // Cadastra automaticamente quem ainda não tem NENHUM cliente vinculado
  // (nem religado por CNPJ acima) — ver os dados completos (contratos,
  // parcelas) não deveria depender de alguém preencher um formulário manual
  // pra cada contato que já existe no Bling. tipo e foro levam um padrão
  // (sempre editável depois, nunca travado); o resto vem do Bling.
  const { data: clientesAtuais } = await supabase.from("clientes").select("bling_contato_id").not("bling_contato_id", "is", null);
  const idsJaCadastrados = new Set((clientesAtuais ?? []).map((c) => c.bling_contato_id));
  const semCadastro = contatosPessoaJuridica.filter((c) => !idsJaCadastrados.has(c.id));

  let novosClientesRegistrados = 0;
  for (const contato of semCadastro) {
    const detalhe = await buscarDetalheContatoBlingComToken(token, contato.id);
    if (!detalhe) continue;
    const { error } = await supabase.from("clientes").insert({
      tipo: "clube",
      razao_social: detalhe.nome,
      cnpj: detalhe.cnpj,
      nome_fantasia: detalhe.fantasia,
      endereco: detalhe.endereco,
      numero: detalhe.numero,
      complemento: detalhe.complemento,
      bairro: detalhe.bairro,
      cep: detalhe.cep,
      municipio: detalhe.municipio,
      uf: detalhe.uf,
      foro_preferencial: "Porto Alegre/RS",
      bling_contato_id: contato.id,
    });
    if (error) {
      console.error(`[sincronizarContatosBling] falha ao auto-cadastrar contato ${contato.id}:`, error.message);
    } else {
      novosClientesRegistrados++;
    }
  }

  return { totalContatos: contatosPessoaJuridica.length, novosClientesRegistrados, baixasImportadas };
}

/**
 * Grava as parcelas no cache (0030) e devolve quantas "baixas" (parcelas que
 * passaram a recebida desde a sincronização anterior) vieram nesta rodada —
 * é o número do toast "Bling sincronizado · N baixas de pagamento importadas".
 * Parcelas que sumiram do Bling (excluídas lá) saem do cache.
 */
async function salvarCacheParcelas(
  supabase: Supa,
  parcelas: Array<{ id: number; contato_id: number; numero_pedido_origem: string | null; vencimento: string; valor: number; situacao: number }>,
  inicioSincronizacao: string,
): Promise<number> {
  const situacaoAnterior = new Map<number, number>();
  for (let pagina = 0; ; pagina++) {
    const { data } = await supabase.from("bling_parcelas").select("id, situacao").range(pagina * 1000, pagina * 1000 + 999);
    for (const p of data ?? []) situacaoAnterior.set(p.id, p.situacao);
    if (!data || data.length < 1000) break;
  }
  const primeiraSincronizacao = situacaoAnterior.size === 0;
  const baixas = primeiraSincronizacao
    ? 0
    : parcelas.filter((p) => p.situacao === 2 && situacaoAnterior.get(p.id) !== 2).length;

  const agora = new Date().toISOString();
  for (let i = 0; i < parcelas.length; i += 500) {
    const { error } = await supabase
      .from("bling_parcelas")
      .upsert(parcelas.slice(i, i + 500).map((p) => ({ ...p, sincronizado_em: agora })));
    if (error) throw new Error(`Falha ao salvar cache de parcelas do Bling: ${error.message}`);
  }
  await supabase.from("bling_parcelas").delete().lt("sincronizado_em", inicioSincronizacao);
  return baixas;
}

async function buscarContasReceberBling(token: string, idContato: number): Promise<Array<ParcelaBling & { numeroPedidoOrigem: string | null }>> {
  const receberResp = await chamarApiBling<{
    data: Array<{ id: number; vencimento: string; valor: number; situacao: number; origem?: { numero: string } }>;
  }>(token, `/contas/receber?idContato=${idContato}&limite=100`);
  return (receberResp.data ?? []).map((c) => ({
    id: c.id,
    vencimento: c.vencimento,
    valor: c.valor,
    situacao: c.situacao,
    numeroPedidoOrigem: c.origem?.numero ?? null,
  }));
}

/** Versão leve só pra saber se há parcela atrasada — usada na listagem de
 * clientes, onde buscar itens/descrição de cada pedido (N+1) seria caro. */
export async function buscarSituacaoPagamentoBling(supabase: Supa, cnpj: string): Promise<{ temParcelaAtrasada: boolean }> {
  let token: string;
  try {
    token = await obterAccessTokenValido(supabase);
  } catch {
    return { temParcelaAtrasada: false };
  }
  const idContato = await buscarIdContatoBling(token, cnpj);
  if (!idContato) return { temParcelaAtrasada: false };
  return buscarSituacaoPagamentoPorIdContato(supabase, idContato);
}

/** Mesma checagem, mas pulando a busca de contato por CNPJ quando o
 * bling_contato_id já é conhecido (cache local em bling_contatos). */
export async function buscarSituacaoPagamentoPorIdContato(supabase: Supa, idContato: number): Promise<{ temParcelaAtrasada: boolean }> {
  let token: string;
  try {
    token = await obterAccessTokenValido(supabase);
  } catch {
    return { temParcelaAtrasada: false };
  }
  const parcelas = await buscarContasReceberBling(token, idContato);
  return { temParcelaAtrasada: parcelas.some((p) => classificarSituacaoParcela(p.situacao, p.vencimento) === "atrasada") };
}

export interface DetalheContatoBling {
  id: number;
  nome: string;
  fantasia: string | null;
  cnpj: string;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
}

/**
 * O Bling é a base oficial de identidade do cliente — razão social, nome
 * fantasia, CNPJ e endereço vêm sempre daqui (ao vivo), nunca do que foi
 * digitado localmente. Usado tanto na tela de detalhe de um cliente já
 * cadastrado (pra mostrar o dado atual, não uma cópia local que pode estar
 * desatualizada ou nunca ter sido preenchida) quanto na visualização de um
 * contato que ainda não tem cadastro local nenhum.
 */
async function buscarDetalheContatoBlingComToken(token: string, idContato: number): Promise<DetalheContatoBling | null> {
  try {
    const resp = await chamarApiBling<{
      data: {
        id: number;
        nome: string;
        fantasia?: string;
        numeroDocumento: string;
        endereco?: {
          geral?: { endereco?: string; numero?: string; complemento?: string; bairro?: string; cep?: string; municipio?: string; uf?: string };
        };
      };
    }>(token, `/contatos/${idContato}`);
    const d = resp.data;
    const geral = d.endereco?.geral;
    return {
      id: d.id,
      nome: d.nome,
      fantasia: d.fantasia || null,
      cnpj: (d.numeroDocumento ?? "").replace(/\D/g, ""),
      endereco: geral?.endereco || null,
      numero: geral?.numero || null,
      complemento: geral?.complemento || null,
      bairro: geral?.bairro || null,
      cep: geral?.cep || null,
      municipio: geral?.municipio || null,
      uf: geral?.uf || null,
    };
  } catch {
    return null;
  }
}

export async function buscarDetalheContatoBling(supabase: Supa, idContato: number): Promise<DetalheContatoBling | null> {
  let token: string;
  try {
    token = await obterAccessTokenValido(supabase);
  } catch {
    return null;
  }
  return buscarDetalheContatoBlingComToken(token, idContato);
}

/**
 * Cruza o cliente com o Bling por CNPJ. Confirmado contra dados reais: GET
 * /contatos?numeroDocumento=X encontra o contato, e tanto /pedidos/vendas
 * quanto /contas/receber aceitam filtrar por idContato.
 */
export async function buscarVisaoBlingDoCliente(supabase: Supa, cnpj: string): Promise<VisaoBlingCliente> {
  let token: string;
  try {
    token = await obterAccessTokenValido(supabase);
  } catch {
    return { conectado: false, contatoEncontrado: false, pedidos: [] };
  }

  const idContato = await buscarIdContatoBling(token, cnpj);
  if (!idContato) return { conectado: true, contatoEncontrado: false, pedidos: [] };

  const [pedidosResp, contasReceber] = await Promise.all([
    chamarApiBling<{ data: Array<{ id: number; numero: number; data: string; total: number }> }>(
      token,
      `/pedidos/vendas?idContato=${idContato}&limite=100`,
    ),
    buscarContasReceberBling(token, idContato),
  ]);

  const parcelasPorNumeroPedido = new Map<string, ParcelaBling[]>();
  for (const conta of contasReceber) {
    if (!conta.numeroPedidoOrigem) continue;
    const lista = parcelasPorNumeroPedido.get(conta.numeroPedidoOrigem) ?? [];
    lista.push({ id: conta.id, vencimento: conta.vencimento, valor: conta.valor, situacao: conta.situacao });
    parcelasPorNumeroPedido.set(conta.numeroPedidoOrigem, lista);
  }

  const pedidos: PedidoVendaBlingResumo[] = [];
  for (const p of pedidosResp.data ?? []) {
    let descricaoItens = "";
    try {
      const detalhe = await chamarApiBling<{ data: { itens?: Array<{ descricao: string }> } }>(token, `/pedidos/vendas/${p.id}`);
      descricaoItens = detalhe.data?.itens?.map((i) => i.descricao).join(", ") ?? "";
    } catch {
      // segue sem descrição se a consulta de detalhe de um pedido específico falhar
    }
    const parcelas = (parcelasPorNumeroPedido.get(String(p.numero)) ?? []).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    pedidos.push({ id: p.id, numero: p.numero, data: p.data, total: p.total, descricaoItens, parcelas });
  }

  return { conectado: true, contatoEncontrado: true, pedidos: pedidos.sort((a, b) => b.data.localeCompare(a.data)) };
}

export type SituacaoParcela = "recebida" | "recebida_parcial" | "atrasada" | "em_aberto";

/**
 * O código numérico de contas/receber só tem 3 valores confirmados contra
 * dados reais da conta (1, 2, 3) e o Bling não expõe um endpoint de consulta
 * de situações pra esse app (/situacoes/{id} retorna 403 insufficient_scope,
 * e não existe escopo "Situações" na lista de permissões do app no Bling).
 * 2 = Recebida e 3 = Recebida parcialmente foram confirmados manualmente no
 * Bling; qualquer outro código (hoje só aparece o 1) é tratado como pendente
 * de recebimento e classificado por data — não existe um código numérico
 * fixo pra "atrasada", é a UI do Bling que deriva isso de vencimento < hoje.
 */
export function classificarSituacaoParcela(situacao: number, vencimento: string): SituacaoParcela {
  if (situacao === 2) return "recebida";
  if (situacao === 3) return "recebida_parcial";
  const hoje = new Date().toISOString().slice(0, 10);
  return vencimento < hoje ? "atrasada" : "em_aberto";
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

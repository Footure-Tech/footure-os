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
// POST /pedidos/vendas: ver blingPedido.ts (envio do pedido aprovado).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

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

/** Escrita na API (POST/PATCH/PUT/DELETE), pela mesma fila de 3 req/s. Devolve o JSON
 * (ou null em 204); erro HTTP vira Error com a mensagem do Bling. */
export async function requisicaoBling<T>(token: string, metodo: "POST" | "PATCH" | "PUT" | "DELETE", caminho: string, corpo?: unknown, tentativa = 0): Promise<T | null> {
  await aguardarVezNaFila();
  const resposta = await fetch(`${API_BASE}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = await resposta.json().catch(() => null);
  if (resposta.status === 429 && tentativa < 2) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return requisicaoBling<T>(token, metodo, caminho, corpo, tentativa + 1);
  }
  if (!resposta.ok) {
    const e = (json as { error?: { message?: string; description?: string; fields?: Array<{ msg?: string }> } } | null)?.error;
    const detalhes = e?.fields?.map((f) => f.msg).filter(Boolean).join("; ");
    throw new Error(`Bling ${metodo} ${caminho} (${resposta.status}): ${[e?.message, e?.description, detalhes].filter(Boolean).join(" — ") || JSON.stringify(json)}`);
  }
  return json as T | null;
}

/** GET exportado para os módulos de integração (mesma fila). */
export function consultarBling<T>(token: string, caminho: string): Promise<T> {
  return chamarApiBling<T>(token, caminho);
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
interface PedidoVendaListado {
  id: number;
  numero: number | string;
  data?: string;
  total?: number;
  situacao?: { id?: number; valor?: number };
}

async function buscarPedidosVenda(token: string, idContato: number): Promise<PedidoVendaListado[]> {
  const resp = await chamarApiBling<{ data: PedidoVendaListado[] }>(token, `/pedidos/vendas?idContato=${idContato}&limite=100`);
  return resp.data ?? [];
}

/**
 * Pedido de venda cancelado no Bling. A situação do pedido é configurável na
 * conta; o padrão do Bling usa id 12 / valor 2 para "Cancelado". AINDA NÃO
 * CONFIRMADO contra dados reais desta conta (ao contrário dos códigos de
 * contas a receber, ver classificarSituacaoParcela) — conferir após a
 * primeira sincronização com bling_pedidos e ajustar só aqui.
 */
export function pedidoBlingCancelado(situacaoId: number | null, situacaoValor: number | null): boolean {
  return situacaoValor === 2 || situacaoId === 12;
}

export async function sincronizarContatosBling(
  supabase: Supa,
): Promise<{
  totalContatos: number;
  novosClientesRegistrados: number;
  baixasImportadas: number;
  baixas: ResultadoBaixas;
}> {
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

  // Vendas do Footlink a pessoa física (agentes) e a clubes estrangeiros: a
  // varredura acima só pega CNPJ, e a conta tem milhares de contatos pessoa
  // física (alunos do Academy). Esses pedidos já são identificados pela
  // sincronização do Academy (produto "Footlink …" fora da loja do Academy,
  // cache academy_vendas) — daqui vêm os contatos e, deles, só os pedidos do
  // Footlink (o mesmo contato pode ter comprado curso). "Licença teste" é teste.
  const { data: vendasFootlinkPf } = await supabase
    .from("academy_vendas")
    .select("bling_pedido_id, contato_id, contato_nome, contato_documento")
    .ilike("produto", "%footlink%")
    .not("produto", "ilike", "%licença teste%")
    .not("contato_id", "is", null);
  const pedidosFootlinkPf = new Set((vendasFootlinkPf ?? []).map((v) => v.bling_pedido_id));
  const contatosPf = new Set<number>();
  for (const v of vendasFootlinkPf ?? []) {
    if (contatosPf.has(v.contato_id!) || candidatosPessoaJuridica.some((c) => c.id === v.contato_id)) continue;
    contatosPf.add(v.contato_id!);
    candidatosPessoaJuridica.push({ id: v.contato_id!, nome: v.contato_nome ?? "—", cnpj: v.contato_documento ?? "", telefone: null });
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
  // Pedidos de venda (0031) e parcelas (0030) de cada contato qualificado, pro cache.
  const pedidosParaCache: Array<{ id: number; contato_id: number; numero: string; data: string | null; total: number; situacao_id: number | null; situacao_valor: number | null }> = [];
  const parcelasParaCache: Array<{ id: number; contato_id: number; numero_pedido_origem: string | null; vencimento: string; valor: number; situacao: number }> = [];
  const hoje = new Date().toISOString().slice(0, 10);
  for (const candidato of candidatosPessoaJuridica) {
    const pf = contatosPf.has(candidato.id);
    const pedidosVenda = (await buscarPedidosVenda(token, candidato.id)).filter((p) => !pf || pedidosFootlinkPf.has(p.id));
    const totalPedidosVenda = pedidosVenda.length;
    if (totalPedidosVenda === 0) continue;
    for (const p of pedidosVenda) {
      pedidosParaCache.push({
        id: p.id,
        contato_id: candidato.id,
        numero: String(p.numero),
        data: p.data && /^\d{4}-\d{2}-\d{2}/.test(p.data) ? p.data.slice(0, 10) : null,
        total: Number(p.total ?? 0),
        situacao_id: p.situacao?.id ?? null,
        situacao_valor: p.situacao?.valor ?? null,
      });
    }
    const numerosPf = new Set(pedidosVenda.map((p) => String(p.numero)));
    const parcelas = (await buscarContasReceberBling(token, candidato.id, dataPrimeiroPedido(pedidosVenda))).filter(
      (p) => !pf || (p.numeroPedidoOrigem !== null && numerosPf.has(p.numeroPedidoOrigem)),
    );
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

  await salvarCachePedidos(supabase, pedidosParaCache, inicioSincronizacao);
  const baixasImportadas = await salvarCacheParcelas(supabase, parcelasParaCache, inicioSincronizacao);
  const baixas = await complementarBaixas(supabase, token);

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
    const match = cnpjLimpo ? contatosPessoaJuridica.find((c) => c.cnpj === cnpjLimpo) : undefined;
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
      // Pessoa física (CPF) é agente; o resto (CNPJ ou clube estrangeiro sem documento) começa como clube.
      tipo: contatosPf.has(contato.id) && detalhe.cnpj.length === 11 ? "agente" : "clube",
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

  return { totalContatos: contatosPessoaJuridica.length, novosClientesRegistrados, baixasImportadas, baixas };
}

/** Parcelas por sincronização que recebem o detalhe da baixa (2 chamadas cada,
 * ~0,7 s com a fila de 3 req/s) — o resto continua na próxima rodada. */
const LIMITE_BAIXAS_POR_SINCRONIZACAO = 120;

export interface ResultadoBaixas {
  /** Parcelas que ganharam data/valor da baixa nesta rodada. */
  detalhadas: number;
  /** Pagas ainda sem o detalhe (ficam para a próxima sincronização). */
  pendentes: number;
  /** O Bling recusou /borderos (403): o app ainda não tem o escopo "Borderôs" — reconectar. */
  escopoBorderosAusente: boolean;
}

/** Data (aaaa-mm-dd) e valor pago de uma conta a receber, via detalhe da conta + borderôs. */
async function buscarBaixaDaConta(token: string, contaId: number): Promise<{ dataPagamento: string | null; valorPago: number | null }> {
  const detalhe = await chamarApiBling<{ data: { valor?: number; saldo?: number; borderos?: Array<number | { id: number }> } }>(
    token,
    `/contas/receber/${contaId}`,
  );
  const conta = detalhe.data ?? {};
  // A forma do array de borderôs não está documentada publicamente — aceita id puro ou { id }.
  const idsBorderos = [...new Set((conta.borderos ?? []).map((b) => (typeof b === "number" ? b : b?.id)).filter((id): id is number => !!id))];
  let dataPagamento: string | null = null;
  for (const idBordero of idsBorderos) {
    const bordero = await chamarApiBling<{ data: { data?: string } }>(token, `/borderos/${idBordero}`);
    const data = bordero.data?.data?.slice(0, 10);
    // Parcela paga em mais de uma vez (parcial): a baixa é a mais recente.
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(data) && (!dataPagamento || data > dataPagamento)) dataPagamento = data;
  }
  const valorPago = typeof conta.valor === "number" && typeof conta.saldo === "number" ? Math.max(0, conta.valor - conta.saldo) : null;
  return { dataPagamento, valorPago };
}

/**
 * Complementa o cache com a baixa (0032) das parcelas pagas — total (2) ou
 * parcial (3) — cuja situação mudou desde a última leitura do detalhe. Só
 * isso entra (a listagem /contas/receber não traz a data de recebimento), o
 * que mantém o custo em poucas chamadas por dia depois da primeira carga.
 */
async function complementarBaixas(supabase: Supa, token: string): Promise<ResultadoBaixas> {
  // Parcela que voltou a ficar em aberto (estorno) perde a baixa antiga.
  await supabase
    .from("bling_parcelas")
    .update({ data_pagamento: null, valor_pago: null, situacao_detalhada: null })
    .not("situacao", "in", "(2,3)")
    .not("situacao_detalhada", "is", null);

  const { data: candidatas, error } = await supabase
    .from("bling_parcelas")
    .select("id, situacao, situacao_detalhada")
    .in("situacao", [2, 3])
    .order("vencimento", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("[bling] falha ao listar parcelas para baixa:", error.message);
    return { detalhadas: 0, pendentes: 0, escopoBorderosAusente: false };
  }
  const pendentes = (candidatas ?? []).filter((p) => p.situacao_detalhada !== p.situacao);

  let detalhadas = 0;
  let escopoBorderosAusente = false;
  for (const parcela of pendentes.slice(0, LIMITE_BAIXAS_POR_SINCRONIZACAO)) {
    try {
      const { dataPagamento, valorPago } = await buscarBaixaDaConta(token, parcela.id);
      await supabase
        .from("bling_parcelas")
        .update({ data_pagamento: dataPagamento, valor_pago: valorPago, situacao_detalhada: parcela.situacao })
        .eq("id", parcela.id);
      detalhadas++;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (/\/borderos\/\d+ retornou 403/.test(mensagem)) {
        escopoBorderosAusente = true;
        break; // sem o escopo, toda chamada de borderô falha — não adianta continuar
      }
      console.error(`[bling] falha ao buscar a baixa da parcela ${parcela.id}:`, mensagem);
    }
  }
  return { detalhadas, pendentes: pendentes.length - detalhadas, escopoBorderosAusente };
}

/** Grava os pedidos de venda no cache (0031); pedidos que sumiram do Bling saem. */
async function salvarCachePedidos(
  supabase: Supa,
  pedidos: Array<{ id: number; contato_id: number; numero: string; data: string | null; total: number; situacao_id: number | null; situacao_valor: number | null }>,
  inicioSincronizacao: string,
) {
  const agora = new Date().toISOString();
  for (let i = 0; i < pedidos.length; i += 500) {
    const { error } = await supabase.from("bling_pedidos").upsert(pedidos.slice(i, i + 500).map((p) => ({ ...p, sincronizado_em: agora })));
    if (error) throw new Error(`Falha ao salvar cache de pedidos do Bling: ${error.message}`);
  }
  await supabase.from("bling_pedidos").delete().lt("sincronizado_em", inicioSincronizacao);
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

/** aaaa-mm-dd + n dias (UTC, sem fuso). */
function somarDias(iso: string, dias: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Contas a receber de um contato. ATENÇÃO (confirmado contra dados reais,
 * out/2026): sem filtro de data o Bling devolve só as contas EMITIDAS nos
 * últimos ~12 meses — contratos mais antigos (ex.: Atlético Mineiro, pedidos
 * de 2025) ficavam sem parcelas. E o filtro aceita no máximo 366 dias por
 * consulta. Por isso, com `desde` (data do primeiro pedido de venda do
 * contato), busca em janelas de 366 dias por data de emissão
 * (tipoFiltroData=E) até hoje, paginando cada janela. Sem `desde` (contato
 * sem pedido de venda), fica a consulta padrão.
 */
async function buscarContasReceberBling(
  token: string,
  idContato: number,
  desde?: string | null,
): Promise<Array<ParcelaBling & { numeroPedidoOrigem: string | null }>> {
  type ContaListada = { id: number; vencimento: string; valor: number; situacao: number; origem?: { numero: string } };
  const consultas: string[] = [];
  const hoje = new Date().toISOString().slice(0, 10);
  if (desde && desde <= hoje) {
    for (let inicio = desde; inicio <= hoje; inicio = somarDias(inicio, 366)) {
      const fim = somarDias(inicio, 365) < hoje ? somarDias(inicio, 365) : hoje;
      consultas.push(`&tipoFiltroData=E&dataInicial=${inicio}&dataFinal=${fim}`);
    }
  } else {
    consultas.push("");
  }

  const porId = new Map<number, ContaListada>();
  for (const filtro of consultas) {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const resp = await chamarApiBling<{ data: ContaListada[] }>(token, `/contas/receber?idContato=${idContato}&limite=100&pagina=${pagina}${filtro}`);
      const lista = resp.data ?? [];
      for (const c of lista) porId.set(c.id, c);
      if (lista.length < 100) break;
    }
  }
  return [...porId.values()].map((c) => ({
    id: c.id,
    vencimento: c.vencimento,
    valor: c.valor,
    situacao: c.situacao,
    numeroPedidoOrigem: c.origem?.numero ?? null,
  }));
}

/** Data do pedido de venda mais antigo (aaaa-mm-dd) — início das janelas de contas a receber. */
function dataPrimeiroPedido(pedidos: Array<{ data?: string }>): string | null {
  return pedidos.reduce<string | null>((min, p) => {
    const d = p.data && /^\d{4}-\d{2}-\d{2}/.test(p.data) && !p.data.startsWith("0000") ? p.data.slice(0, 10) : null;
    return d && (!min || d < min) ? d : min;
  }, null);
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
  const parcelas = await buscarContasReceberBling(token, idContato, dataPrimeiroPedido(await buscarPedidosVenda(token, idContato)));
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

export interface DetalhePedidoVendaBling {
  id: number;
  numero: string;
  data: string | null;
  total: number;
  totalProdutos: number;
  desconto: number;
  numeroPedidoCompra: string | null;
  observacoes: string | null;
  observacoesInternas: string | null;
  itens: { descricao: string; codigo: string | null; quantidade: number; valor: number }[];
}

/** Data do Bling ("0000-00-00" = vazia) → aaaa-mm-dd ou null. */
function dataBling(valor: string | undefined | null): string | null {
  return valor && !valor.startsWith("0000") ? valor.slice(0, 10) : null;
}

/**
 * Detalhe de um pedido de venda (GET /pedidos/vendas/{id}) — itens,
 * observações e observações internas não vêm na listagem nem ficam no cache,
 * então a tela de detalhe do contrato busca ao vivo (uma chamada). Null se o
 * Bling não estiver conectado ou a chamada falhar — a tela cai no cache.
 */
export async function buscarPedidoVendaBling(supabase: Supa, idPedido: number): Promise<DetalhePedidoVendaBling | null> {
  try {
    const token = await obterAccessTokenValido(supabase);
    const { data: d } = await chamarApiBling<{
      data: {
        id: number;
        numero: number | string;
        data?: string;
        total?: number;
        totalProdutos?: number;
        desconto?: { valor?: number };
        numeroPedidoCompra?: string;
        observacoes?: string;
        observacoesInternas?: string;
        itens?: Array<{ descricao?: string; codigo?: string; quantidade?: number; valor?: number }>;
      };
    }>(token, `/pedidos/vendas/${idPedido}`);
    return {
      id: d.id,
      numero: String(d.numero),
      data: dataBling(d.data),
      total: Number(d.total ?? 0),
      totalProdutos: Number(d.totalProdutos ?? 0),
      desconto: Number(d.desconto?.valor ?? 0),
      numeroPedidoCompra: d.numeroPedidoCompra?.trim() || null,
      observacoes: d.observacoes?.trim() || null,
      observacoesInternas: d.observacoesInternas?.trim() || null,
      itens: (d.itens ?? []).map((i) => ({
        descricao: i.descricao?.trim() || "Item",
        codigo: i.codigo?.trim() || null,
        quantidade: Number(i.quantidade ?? 1),
        valor: Number(i.valor ?? 0),
      })),
    };
  } catch (erro) {
    console.error("[bling] detalhe do pedido de venda:", erro instanceof Error ? erro.message : erro);
    return null;
  }
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

  // Pedidos primeiro: a data do mais antigo define as janelas das contas a receber.
  const pedidosResp = await chamarApiBling<{ data: Array<{ id: number; numero: number; data: string; total: number }> }>(
    token,
    `/pedidos/vendas?idContato=${idContato}&limite=100`,
  );
  const contasReceber = await buscarContasReceberBling(token, idContato, dataPrimeiroPedido(pedidosResp.data ?? []));

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

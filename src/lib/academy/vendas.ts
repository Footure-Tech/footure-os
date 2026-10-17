// Footure Academy · Vendas (0042): pedidos de venda da loja do Academy no Bling
// (e-commerce, compradores pessoa física). Ficam num cache próprio
// (academy_vendas), preenchido na mesma sincronização do Bling; o curso vem do
// detalhe do pedido, buscado só para pedidos novos (a listagem não traz itens).
//
// Vendas = cursos de especialização + cursos livres, fora os cancelados
// (atendidos e em aberto). Assinaturas (Silver/Gold, Footure Insights) e as
// cobranças recorrentes de curso já vendido ("Assinatura - <curso> (Nome)")
// ficam no cache, mas não contam como venda — nem produtos que não são curso
// (camiseta, licença de teste do Footlink).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaAcademy, Database } from "@/lib/supabase/database.types";
import { consultarBling, pedidoBlingCancelado } from "@/lib/integracoes/bling";
import { hojeLocal } from "@/lib/financeiro/carteira";

type Supa = SupabaseClient<Database>;

/** Loja do Footure Academy no Bling (os pedidos do Footlink são da loja 0). */
export const LOJA_ACADEMY_BLING = 203655786;
/** Início do histórico sincronizado. */
const ACADEMY_DESDE = "2024-01-01";
/** Detalhes de pedido (1 chamada cada, ~0,35 s na fila) por sincronização — o resto fica para a próxima. */
const LIMITE_DETALHES_POR_SINCRONIZACAO = 400;

export type CategoriaVendaAcademy = Extract<CategoriaAcademy, "especializacao" | "livre">;

/**
 * Classificação pelo nome do produto (decisão de produto, out/2026). Curso
 * vendido com pagamento recorrente ("Assinatura - Combo Analista…", sem nome
 * de aluno) conta como venda do curso; com nome de aluno entre parênteses é a
 * cobrança recorrente de uma venda já feita (mensalidade).
 */
export function classificarProdutoAcademy(produto: string): CategoriaAcademy {
  const nome = produto.trim();
  // Cobrança recorrente de um curso já vendido: "Assinatura - Certificação … (Ana Carla)".
  if (/^assinatura\s*-.*\([^)]+\)\s*$/i.test(nome)) return "mensalidade";
  if (/\b(silver|gold)\b|footure insights/i.test(nome)) return "assinatura";
  // Produto que não é curso (0043): camiseta, licença de teste do Footlink.
  if (/camiseta|licen[çc]a teste/i.test(nome)) return "outro";
  if (/^(assinatura\s*-\s*)?especializa[çc][ãa]o\b/i.test(nome) || /certifica[çc][ãa]o executivo de futebol/i.test(nome)) return "especializacao";
  return "livre";
}

function somarDias(iso: string, dias: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

interface PedidoListado {
  id: number;
  numero: number | string;
  data?: string;
  total?: number;
  situacao?: { id?: number; valor?: number };
  contato?: { id?: number; nome?: string; numeroDocumento?: string };
}

/**
 * Atualiza o cache academy_vendas: lista os pedidos da loja do Academy em
 * janelas de 366 dias (limite do filtro de data do Bling), atualiza situação e
 * total dos já conhecidos e busca o detalhe (curso) só dos novos. Pedidos que
 * sumiram do Bling saem do cache.
 */
export async function sincronizarVendasAcademy(supabase: Supa, token: string): Promise<{ novas: number; pendentes: number }> {
  const inicio = new Date().toISOString();
  const hoje = hojeLocal();
  const listados = new Map<number, PedidoListado>();
  for (let de = ACADEMY_DESDE; de <= hoje; de = somarDias(de, 366)) {
    const ate = somarDias(de, 365) < hoje ? somarDias(de, 365) : hoje;
    for (let pagina = 1; pagina <= 50; pagina++) {
      const resp = await consultarBling<{ data: PedidoListado[] }>(
        token,
        `/pedidos/vendas?idLoja=${LOJA_ACADEMY_BLING}&dataInicial=${de}&dataFinal=${ate}&limite=100&pagina=${pagina}`,
      );
      const lista = resp.data ?? [];
      for (const p of lista) listados.set(p.id, p);
      if (lista.length < 100) break;
    }
  }

  const conhecidos = new Map<number, { produto: string | null; categoria: CategoriaAcademy }>();
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase.from("academy_vendas").select("bling_pedido_id, produto, categoria").range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error(`Falha ao ler o cache de vendas do Academy: ${error.message}`);
    for (const v of data ?? []) conhecidos.set(v.bling_pedido_id, { produto: v.produto, categoria: v.categoria });
    if (!data || data.length < 1000) break;
  }

  const novos = [...listados.values()].filter((p) => !conhecidos.has(p.id));
  for (const p of novos.slice(0, LIMITE_DETALHES_POR_SINCRONIZACAO)) {
    try {
      const detalhe = await consultarBling<{ data: { itens?: Array<{ descricao?: string; valor?: number; quantidade?: number }> } }>(token, `/pedidos/vendas/${p.id}`);
      const itens = (detalhe.data?.itens ?? []).filter((i) => i.descricao?.trim());
      const produto = itens.map((i) => i.descricao!.trim()).join(" + ") || null;
      // Pedido com mais de um curso: a categoria é a do item de maior valor.
      const principal = itens.reduce<(typeof itens)[number] | null>(
        (max, i) => (!max || (i.valor ?? 0) * (i.quantidade ?? 1) > (max.valor ?? 0) * (max.quantidade ?? 1) ? i : max),
        null,
      );
      conhecidos.set(p.id, { produto, categoria: classificarProdutoAcademy(principal?.descricao ?? "") });
    } catch (erro) {
      console.error(`[academy] falha ao buscar o pedido ${p.id}:`, erro instanceof Error ? erro.message : erro);
    }
  }

  const agora = new Date().toISOString();
  const linhas = [...listados.values()]
    .filter((p) => conhecidos.has(p.id))
    .map((p) => ({
      bling_pedido_id: p.id,
      numero: String(p.numero),
      data: p.data && /^\d{4}-\d{2}-\d{2}/.test(p.data) && !p.data.startsWith("0000") ? p.data.slice(0, 10) : null,
      total: Number(p.total ?? 0),
      situacao_id: p.situacao?.id ?? null,
      situacao_valor: p.situacao?.valor ?? null,
      contato_id: p.contato?.id ?? null,
      contato_nome: p.contato?.nome ?? null,
      contato_documento: p.contato?.numeroDocumento?.replace(/\D/g, "") || null,
      ...conhecidos.get(p.id)!,
      sincronizado_em: agora,
    }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from("academy_vendas").upsert(linhas.slice(i, i + 500));
    if (error) throw new Error(`Falha ao salvar o cache de vendas do Academy: ${error.message}`);
  }
  // Só apaga o que sumiu do Bling; pedido novo ainda sem detalhe nem entrou.
  await supabase.from("academy_vendas").delete().lt("sincronizado_em", inicio);

  const novas = Math.min(novos.length, LIMITE_DETALHES_POR_SINCRONIZACAO);
  return { novas, pendentes: novos.length - novas };
}

export type PeriodoVendasAcademy = "mes" | "tri" | "12m";
const MESES: Record<PeriodoVendasAcademy, number> = { mes: 1, tri: 3, "12m": 12 };

export interface VendaAcademy {
  blingPedidoId: number;
  numeroPedido: string;
  cliente: string;
  documento: string | null;
  curso: string;
  categoria: CategoriaVendaAcademy;
  dataVenda: string;
  valorTotal: number;
  sdr: string | null;
  closer: string | null;
}

function inicioDoMes(hoje: string, delta: number) {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function carregarVendasAcademy(supabase: Supa) {
  const hoje = hojeLocal();
  const [{ data, error }, { data: equipes }, { data: perfis }] = await Promise.all([
    supabase
      .from("academy_vendas")
      .select("bling_pedido_id, numero, data, total, situacao_id, situacao_valor, contato_nome, contato_documento, produto, categoria, sincronizado_em")
      .in("categoria", ["especializacao", "livre"])
      .not("data", "is", null)
      .order("data", { ascending: false }),
    supabase.from("contrato_equipe_bling").select("bling_pedido_id, sdr_id, closer_id"),
    supabase.from("profiles").select("user_id, nome"),
  ]);
  if (error) console.error("[academy] vendas:", error.message);
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  const equipe = new Map((equipes ?? []).map((e) => [e.bling_pedido_id, e]));
  const pessoa = (id: string | null | undefined) => (id ? (nome.get(id) ?? null) : null);

  const vendas: VendaAcademy[] = (data ?? [])
    .filter((v) => !pedidoBlingCancelado(v.situacao_id, v.situacao_valor))
    .map((v) => ({
      blingPedidoId: v.bling_pedido_id,
      numeroPedido: v.numero,
      cliente: v.contato_nome ?? "—",
      documento: v.contato_documento,
      curso: v.produto ?? "—",
      categoria: v.categoria as CategoriaVendaAcademy,
      dataVenda: v.data!,
      valorTotal: Number(v.total),
      sdr: pessoa(equipe.get(v.bling_pedido_id)?.sdr_id),
      closer: pessoa(equipe.get(v.bling_pedido_id)?.closer_id),
    }))
    .sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || Number(b.numeroPedido) - Number(a.numeroPedido));

  const doPeriodo = (periodo: PeriodoVendasAcademy) => {
    const inicio = inicioDoMes(hoje, -(MESES[periodo] - 1));
    return vendas.filter((v) => v.dataVenda >= inicio && v.dataVenda <= hoje);
  };
  const sincronizadoEm = (data ?? []).reduce<string | null>((max, v) => (!max || v.sincronizado_em > max ? v.sincronizado_em : max), null);
  return { doPeriodo, sincronizadoEm, temCache: (data ?? []).length > 0 };
}

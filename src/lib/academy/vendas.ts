// Footure Academy · Vendas (0042): pedidos de venda do Academy no Bling — os da
// loja do Academy (e-commerce) e os lançados sem loja para pessoa física ou
// estrangeiro (ver pedidoDoAcademy). Ficam num cache próprio
// (academy_vendas), preenchido na mesma sincronização do Bling; o curso vem do
// detalhe do pedido, buscado só para pedidos novos (a listagem não traz itens).
//
// Vendas = cursos de especialização + cursos livres, fora os cancelados
// (atendidos e em aberto). Assinaturas (Silver/Gold, Footure Insights) e as
// cobranças recorrentes de curso já vendido ("Assinatura - <curso> (Nome)")
// ficam no cache, mas não contam como venda — nem produtos que não são curso
// (camiseta, licença de teste do Footlink). Cursos e edições (nomes
// padronizados, ciclos de venda, rateio de pedido com mais de um curso): ./cursos.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaAcademy, Database, PagamentoAcademy } from "@/lib/supabase/database.types";
import { consultarBling, pedidoBlingCancelado } from "@/lib/integracoes/bling";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { edicaoDeCancelada, edicoes, itensDoPedido, nomePadronizado, ratearPedido, slugCurso } from "./cursos";

type Supa = SupabaseClient<Database>;

/** Loja do Footure Academy no Bling (os pedidos do Footlink são da loja 0). */
export const LOJA_ACADEMY_BLING = 203655786;
/** Início do histórico sincronizado. */
const ACADEMY_DESDE = "2024-01-01";
/** Detalhes de pedido (1 chamada cada, ~0,35 s na fila) por sincronização — o resto fica para a próxima. */
const LIMITE_DETALHES_POR_SINCRONIZACAO = 400;

export type CategoriaVendaAcademy = Extract<CategoriaAcademy, "especializacao" | "livre" | "hotmart">;
const CATEGORIAS_VENDA: CategoriaVendaAcademy[] = ["especializacao", "livre", "hotmart"];
const ehVenda = (c: CategoriaAcademy): c is CategoriaVendaAcademy => (CATEGORIAS_VENDA as CategoriaAcademy[]).includes(c);

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
  // Produto que não é curso (0043): camiseta, licença de teste do Footlink; também
  // as vendas do Footlink a pessoa física (agentes) que estão sem loja no Bling,
  // assessoria, prospecção e The Board (serviços).
  if (/camiseta|licen[çc]a teste|footlink|^assessoria\b|prospec[çc][ãa]o de clubes|^the board$/i.test(nome)) return "outro";
  // Venda pela Hotmart (0045): o Bling recebe um item genérico com o nome da empresa, sem o curso.
  if (/^footure produtora\b/i.test(nome)) return "hotmart";
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
  loja?: { id?: number };
  contato?: { id?: number; nome?: string; numeroDocumento?: string; tipoPessoa?: string };
}

/**
 * Pedido que pode ser venda do Academy: todos da loja do Academy e, sem loja
 * (loja 0), os de pessoa física e estrangeiro — até mar/2025 (e parte depois)
 * as vendas de curso foram lançadas sem loja. Sem loja e pessoa jurídica é
 * Footlink (clientes PJ). O produto decide o resto (classificarProdutoAcademy).
 */
function pedidoDoAcademy(p: PedidoListado) {
  const loja = p.loja?.id ?? 0;
  return loja === LOJA_ACADEMY_BLING || (loja === 0 && p.contato?.tipoPessoa !== "J");
}

interface PedidoDetalhe {
  totalProdutos?: number;
  desconto?: { valor?: number };
  observacoes?: string;
  numeroLoja?: string;
  itens?: Array<{ descricao?: string; valor?: number; quantidade?: number }>;
  parcelas?: Array<{ valor?: number; formaPagamento?: { id?: number } }>;
}

interface FormaPagamentoBling {
  descricao?: string;
  taxas?: { aliquota?: number; valor?: number };
}

/** Meio e nº de parcelas do cartão pela descrição da forma de pagamento (o Bling não tem campo numérico para as parcelas). */
export function meioDaForma(descricao: string): Pick<PagamentoAcademy, "meio" | "parcelasCartao"> {
  if (/\bpix\b/i.test(descricao)) return { meio: "pix", parcelasCartao: null };
  if (/boleto/i.test(descricao)) return { meio: "boleto", parcelasCartao: null };
  if (/cart[ãa]o/i.test(descricao)) return { meio: "cartao", parcelasCartao: Number(/(\d+)\s*x\b/i.exec(descricao)?.[1] ?? 1) };
  return { meio: "outro", parcelasCartao: null };
}

/** Algumas descrições vêm do e-commerce com entidades HTML ("Mercado &amp; Desempenho"). */
const decodificarHtml = (t: string) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Campos do detalhe do pedido gravados no cache (curso, categoria e pagamento). */
async function lerDetalhePedido(token: string, id: number, formas: Map<number, FormaPagamentoBling>) {
  const { data: d } = await consultarBling<{ data: PedidoDetalhe }>(token, `/pedidos/vendas/${id}`);
  const itens = (d.itens ?? []).filter((i) => i.descricao?.trim()).map((i) => ({ ...i, descricao: decodificarHtml(i.descricao!.trim()) }));
  const produto = itens.map((i) => i.descricao).join(" + ") || null;
  // Pedido com mais de um curso: a categoria é a do item de maior valor.
  const principal = itens.reduce<(typeof itens)[number] | null>(
    (max, i) => (!max || (i.valor ?? 0) * (i.quantidade ?? 1) > (max.valor ?? 0) * (max.quantidade ?? 1) ? i : max),
    null,
  );
  const pagamentos: PagamentoAcademy[] = [];
  for (const parcela of d.parcelas ?? []) {
    const formaId = parcela.formaPagamento?.id ?? 0;
    if (formaId && !formas.has(formaId)) formas.set(formaId, (await consultarBling<{ data: FormaPagamentoBling }>(token, `/formas-pagamentos/${formaId}`)).data);
    const forma = formas.get(formaId);
    const descricao = forma?.descricao ?? "Não informada";
    pagamentos.push({
      formaId,
      descricao,
      ...meioDaForma(descricao),
      valor: Number(parcela.valor ?? 0),
      aliquota: Number(forma?.taxas?.aliquota ?? 0),
      taxaFixa: Number(forma?.taxas?.valor ?? 0),
    });
  }
  return {
    produto,
    categoria: classificarProdutoAcademy(principal?.descricao ?? ""),
    total_produtos: d.totalProdutos ?? null,
    desconto: d.desconto?.valor ?? null,
    cupom: /cupom:\s*([^\s-]+)/i.exec(d.observacoes ?? "")?.[1] ?? null,
    numero_loja: d.numeroLoja || null,
    pagamentos,
    detalhado_em: new Date().toISOString(),
  };
}

type DetalheCache = Awaited<ReturnType<typeof lerDetalhePedido>>;

/**
 * Atualiza o cache academy_vendas: lista os pedidos da loja do Academy em
 * janelas de 366 dias (limite do filtro de data do Bling), atualiza situação e
 * total dos já conhecidos e busca o detalhe (curso e pagamento) dos novos e dos
 * ainda sem pagamento lido. Pedidos que sumiram do Bling saem do cache. Depois,
 * complementa a taxa real das vendas já recebidas (complementarBaixasAcademy).
 */
export async function sincronizarVendasAcademy(supabase: Supa, token: string): Promise<{ novas: number; pendentes: number; baixas: number }> {
  const inicio = new Date().toISOString();
  const hoje = hojeLocal();
  const listados = new Map<number, PedidoListado>();
  for (let de = ACADEMY_DESDE; de <= hoje; de = somarDias(de, 366)) {
    const ate = somarDias(de, 365) < hoje ? somarDias(de, 365) : hoje;
    for (let pagina = 1; pagina <= 50; pagina++) {
      const resp = await consultarBling<{ data: PedidoListado[] }>(token, `/pedidos/vendas?dataInicial=${de}&dataFinal=${ate}&limite=100&pagina=${pagina}`);
      const lista = resp.data ?? [];
      for (const p of lista) if (pedidoDoAcademy(p)) listados.set(p.id, p);
      if (lista.length < 100) break;
    }
  }

  const conhecidos = new Map<number, { produto: string | null; categoria: CategoriaAcademy; detalhado_em: string | null }>();
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from("academy_vendas")
      .select("bling_pedido_id, produto, categoria, detalhado_em")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error(`Falha ao ler o cache de vendas do Academy: ${error.message}`);
    for (const v of data ?? []) conhecidos.set(v.bling_pedido_id, { produto: v.produto, categoria: v.categoria, detalhado_em: v.detalhado_em });
    if (!data || data.length < 1000) break;
  }

  // Novos primeiro; depois os já conhecidos sem pagamento lido (carga inicial do 0044).
  const paraDetalhar = [...listados.values()]
    .filter((p) => !conhecidos.get(p.id)?.detalhado_em)
    .sort((a, b) => Number(conhecidos.has(a.id)) - Number(conhecidos.has(b.id)));
  const formas = new Map<number, FormaPagamentoBling>();
  const detalhados = new Map<number, DetalheCache>();
  for (const p of paraDetalhar.slice(0, LIMITE_DETALHES_POR_SINCRONIZACAO)) {
    try {
      detalhados.set(p.id, await lerDetalhePedido(token, p.id, formas));
    } catch (erro) {
      console.error(`[academy] falha ao buscar o pedido ${p.id}:`, erro instanceof Error ? erro.message : erro);
    }
  }

  const agora = new Date().toISOString();
  const linhas = [...listados.values()]
    .filter((p) => conhecidos.has(p.id) || detalhados.has(p.id))
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
      // Já conhecido sem detalhe novo: só curso/categoria (o upsert mantém as demais colunas).
      ...(detalhados.get(p.id) ?? { produto: conhecidos.get(p.id)!.produto, categoria: conhecidos.get(p.id)!.categoria }),
      sincronizado_em: agora,
    }));
  // Upsert em dois grupos: as colunas enviadas precisam ser as mesmas em cada lote.
  const comDetalhe = linhas.filter((l) => "detalhado_em" in l);
  const semDetalhe = linhas.filter((l) => !("detalhado_em" in l));
  for (const grupo of [comDetalhe, semDetalhe]) {
    for (let i = 0; i < grupo.length; i += 500) {
      const { error } = await supabase.from("academy_vendas").upsert(grupo.slice(i, i + 500));
      if (error) throw new Error(`Falha ao salvar o cache de vendas do Academy: ${error.message}`);
    }
  }
  // Só apaga o que sumiu do Bling; pedido novo ainda sem detalhe nem entrou.
  await supabase.from("academy_vendas").delete().lt("sincronizado_em", inicio);

  const novasLidas = paraDetalhar.slice(0, LIMITE_DETALHES_POR_SINCRONIZACAO).filter((p) => !conhecidos.has(p.id) && detalhados.has(p.id)).length;
  const baixas = await complementarBaixasAcademy(supabase, token);
  return { novas: novasLidas, pendentes: Math.max(0, paraDetalhar.length - LIMITE_DETALHES_POR_SINCRONIZACAO), baixas };
}

/** Contas com baixa detalhadas por sincronização (2 chamadas cada) — o resto fica para a próxima. */
const LIMITE_BAIXAS_POR_SINCRONIZACAO = 150;
/** Pedido consultado sem baixa completa volta a ser consultado enquanto for recente. */
const DIAS_RECONSULTA_BAIXA = 60;

/**
 * Taxa real e valor recebido das vendas (0044): lista as contas a receber da
 * conta inteira por data de emissão (janelas de 366 dias, desde a venda
 * pendente mais antiga), separa as dos pedidos do Academy e, quando todas as
 * contas de um pedido estão recebidas, soma tarifa e valor pago dos borderôs.
 * Pendente = nunca consultado, ou recente e ainda sem baixa completa.
 */
async function complementarBaixasAcademy(supabase: Supa, token: string): Promise<number> {
  const limiteRecente = somarDias(hojeLocal(), -DIAS_RECONSULTA_BAIXA);
  const { data: pendentes, error } = await supabase
    .from("academy_vendas")
    .select("bling_pedido_id, data")
    .is("taxa_real", null)
    .not("data", "is", null)
    .in("categoria", CATEGORIAS_VENDA)
    .neq("situacao_id", 12)
    .or(`baixa_consultada_em.is.null,data.gte.${limiteRecente}`);
  if (error) {
    console.error("[academy] falha ao listar vendas sem baixa:", error.message);
    return 0;
  }
  if (!pendentes?.length) return 0;
  const ids = new Set(pendentes.map((p) => p.bling_pedido_id));
  const desde = pendentes.reduce((min, p) => (p.data! < min ? p.data! : min), pendentes[0].data!);

  type ContaListada = { id: number; situacao: number; idOrigem?: number; origem?: { id?: number } };
  const contasPorPedido = new Map<number, ContaListada[]>();
  const hoje = hojeLocal();
  for (let de = desde; de <= hoje; de = somarDias(de, 366)) {
    const ate = somarDias(de, 365) < hoje ? somarDias(de, 365) : hoje;
    for (let pagina = 1; pagina <= 100; pagina++) {
      const resp = await consultarBling<{ data: ContaListada[] }>(token, `/contas/receber?tipoFiltroData=E&dataInicial=${de}&dataFinal=${ate}&limite=100&pagina=${pagina}`);
      const lista = resp.data ?? [];
      for (const c of lista) {
        const pedido = c.origem?.id ?? c.idOrigem;
        if (pedido && ids.has(pedido)) contasPorPedido.set(pedido, [...(contasPorPedido.get(pedido) ?? []), c]);
      }
      if (lista.length < 100) break;
    }
  }

  let detalhadas = 0;
  let gravadas = 0;
  const agora = new Date().toISOString();
  const semBaixa: number[] = [];
  for (const pedidoId of ids) {
    const contas = contasPorPedido.get(pedidoId) ?? [];
    const recebidas = contas.length > 0 && contas.every((c) => c.situacao === 2);
    if (!recebidas) semBaixa.push(pedidoId);
    if (!recebidas || detalhadas + contas.length > LIMITE_BAIXAS_POR_SINCRONIZACAO) continue;
    try {
      let tarifa = 0;
      let pago = 0;
      let baixaEm: string | null = null;
      for (const conta of contas) {
        const { data: d } = await consultarBling<{ data: { numeroDocumento?: string; borderos?: Array<number | { id: number }> } }>(token, `/contas/receber/${conta.id}`);
        for (const b of d.borderos ?? []) {
          const { data: bordero } = await consultarBling<{
            data: { data?: string; pagamentos?: Array<{ numeroDocumento?: string; valorPago?: number; tarifa?: number }> };
          }>(token, `/borderos/${typeof b === "number" ? b : b.id}`);
          const pagamentos = bordero.pagamentos ?? [];
          // Borderô pode reunir várias contas: fica só o pagamento desta (pelo nº do documento).
          for (const pg of pagamentos.length > 1 ? pagamentos.filter((x) => x.numeroDocumento === d.numeroDocumento) : pagamentos) {
            tarifa += Number(pg.tarifa ?? 0);
            pago += Number(pg.valorPago ?? 0);
          }
          const data = bordero.data?.slice(0, 10);
          if (data && (!baixaEm || data > baixaEm)) baixaEm = data;
        }
        detalhadas++;
      }
      await supabase
        .from("academy_vendas")
        .update({ taxa_real: Math.round(tarifa * 100) / 100, valor_recebido: Math.round(pago * 100) / 100, baixa_em: baixaEm, baixa_consultada_em: agora })
        .eq("bling_pedido_id", pedidoId);
      gravadas++;
    } catch (erro) {
      console.error(`[academy] falha ao ler a baixa do pedido ${pedidoId}:`, erro instanceof Error ? erro.message : erro);
    }
  }
  for (let i = 0; i < semBaixa.length; i += 200) {
    await supabase.from("academy_vendas").update({ baixa_consultada_em: agora }).in("bling_pedido_id", semBaixa.slice(i, i + 200));
  }
  return gravadas;
}

export type PeriodoVendasAcademy = "mes" | "tri" | "12m";
const MESES: Record<PeriodoVendasAcademy, number> = { mes: 1, tri: 3, "12m": 12 };

/** Alíquota de impostos sobre o valor bruto das vendas do Academy (decisão de produto, out/2026). */
export const ALIQUOTA_IMPOSTOS_ACADEMY = 0.13;

export type SituacaoVendaAcademy = "atendido" | "em_aberto" | "cancelado";

/** Uma forma de pagamento usada na venda (parte da venda, quando o pedido foi pago de mais de um jeito). */
export interface PagamentoVenda {
  /** Ex.: "Cartão 12x", "Pix", "Boleto". */
  rotulo: string;
  meio: PagamentoAcademy["meio"] | "nao_lido";
  parcelas: number | null;
  valor: number;
  taxa: number;
}

/** Uma venda de curso. Pedido com mais de um curso vira uma venda por curso (valor rateado). */
export interface VendaAcademy {
  blingPedidoId: number;
  numeroPedido: string;
  cliente: string;
  /** CPF/CNPJ mascarado — o completo só por ação explícita (revelarDocumentoAction). */
  documentoMascarado: string | null;
  /** Edição do curso (nome padronizado; com o mês de início quando o nome não tem ano). */
  curso: string;
  cursoSlug: string;
  /** Item como está no Bling. */
  produto: string;
  categoria: CategoriaVendaAcademy;
  situacao: SituacaoVendaAcademy;
  dataVenda: string;
  /** Valor bruto da venda (a parte do curso, quando o pedido tem mais de um). */
  valorTotal: number;
  valorPedido: number;
  /** Pedido com mais de um curso: valor rateado pelo ticket médio. */
  rateado: boolean;
  pagamentos: PagamentoVenda[];
  /** Taxa de intermediação: real (borderô do Bling) ou estimada pela forma de pagamento. */
  taxa: number;
  taxaReal: boolean;
  impostos: number;
  /** Bruto − taxa − impostos. */
  liquido: number;
  sdr: string | null;
  closer: string | null;
}

/** CPF/CNPJ com o meio visível: ***.214.798-** / **.345.678/0001-** */
export function mascararDocumento(doc: string | null) {
  if (doc?.length === 11) return `***.${doc.slice(3, 6)}.${doc.slice(6, 9)}-**`;
  if (doc?.length === 14) return `**.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-**`;
  return doc ? "***" : null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Pagamentos do pedido rateados para a venda (fração `f` do pedido), com a taxa do pedido distribuída entre eles. */
function pagamentosDaVenda(pagamentos: PagamentoAcademy[] | null, taxaPedido: number, f: number): PagamentoVenda[] {
  if (!pagamentos?.length) return [{ rotulo: "Não lida", meio: "nao_lido", parcelas: null, valor: 0, taxa: 0 }];
  const estimadas = pagamentos.map((p) => (p.valor * p.aliquota) / 100 + p.taxaFixa);
  const somaEstimadas = estimadas.reduce((s, t) => s + t, 0);
  const somaValores = pagamentos.reduce((s, p) => s + p.valor, 0) || 1;
  return pagamentos.map((p, i) => ({
    rotulo: p.meio === "cartao" ? `Cartão ${p.parcelasCartao ?? 1}x` : p.meio === "pix" ? "Pix" : p.meio === "boleto" ? "Boleto" : "Sem forma definida",
    meio: p.meio,
    parcelas: p.parcelasCartao,
    valor: arred(p.valor * f),
    taxa: arred(taxaPedido * f * (somaEstimadas > 0 ? estimadas[i] / somaEstimadas : p.valor / somaValores)),
  }));
}

/** Edição de curso: histórico completo e o recorte do período selecionado. */
export interface CursoAcademy {
  slug: string;
  nome: string;
  categoria: CategoriaVendaAcademy;
  /** Vendas e valor no período selecionado. */
  vendasPeriodo: number;
  valorPeriodo: number;
  /** Vendas e valor de todo o histórico da edição. */
  vendasTotal: number;
  valorTotal: number;
  primeiraVenda: string;
  ultimaVenda: string;
}

/** Cursos com o histórico completo; `periodo` = vendas do período selecionado. */
function agruparCursos(todas: VendaAcademy[], periodo: VendaAcademy[]): CursoAcademy[] {
  const cursos = new Map<string, CursoAcademy>();
  for (const v of todas) {
    const c = cursos.get(v.cursoSlug) ?? {
      slug: v.cursoSlug,
      nome: v.curso,
      categoria: v.categoria,
      vendasPeriodo: 0,
      valorPeriodo: 0,
      vendasTotal: 0,
      valorTotal: 0,
      primeiraVenda: v.dataVenda,
      ultimaVenda: v.dataVenda,
    };
    c.vendasTotal++;
    c.valorTotal += v.valorTotal;
    if (v.dataVenda < c.primeiraVenda) c.primeiraVenda = v.dataVenda;
    if (v.dataVenda > c.ultimaVenda) c.ultimaVenda = v.dataVenda;
    cursos.set(v.cursoSlug, c);
  }
  for (const v of periodo) {
    const c = cursos.get(v.cursoSlug)!;
    c.vendasPeriodo++;
    c.valorPeriodo += v.valorTotal;
  }
  return [...cursos.values()];
}

function inicioDoMes(hoje: string, delta: number) {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Mesma venda lançada duas vezes no Bling — na loja do Academy e sem loja
 * (decisão de produto, out/2026: conta uma só). Duplicado = outro pedido não
 * cancelado do mesmo comprador (CPF ou contato), mesmos produtos, mesmo valor
 * e até 3 dias de diferença. Fica o da loja (tem os dados do e-commerce); entre
 * dois iguais, o de menor id.
 */
function duplicado<
  P extends { bling_pedido_id: number; data: string | null; total: number; produto: string | null; contato_id: number | null; contato_documento: string | null; numero_loja: string | null; cancelado: boolean },
>(p: P, todos: P[]) {
  if (p.cancelado) return false;
  const comprador = (x: P) => x.contato_documento || (x.contato_id ? String(x.contato_id) : null);
  const preferido = (a: P, b: P) => (!!a.numero_loja !== !!b.numero_loja ? !!a.numero_loja : a.bling_pedido_id < b.bling_pedido_id);
  return todos.some(
    (o) =>
      o !== p &&
      !o.cancelado &&
      comprador(o) !== null &&
      comprador(o) === comprador(p) &&
      o.produto === p.produto &&
      Math.abs(Number(o.total) - Number(p.total)) < 1 &&
      Math.abs(Date.parse(o.data!) - Date.parse(p.data!)) <= 3 * 86_400_000 &&
      preferido(o, p),
  );
}

export async function carregarVendasAcademy(supabase: Supa) {
  const hoje = hojeLocal();
  const [{ data, error }, { data: equipes }, { data: perfis }] = await Promise.all([
    supabase
      .from("academy_vendas")
      .select(
        "bling_pedido_id, numero, data, total, situacao_id, situacao_valor, contato_id, contato_nome, contato_documento, produto, categoria, sincronizado_em, pagamentos, taxa_real, numero_loja",
      )
      .in("categoria", CATEGORIAS_VENDA)
      .not("data", "is", null)
      .order("data", { ascending: false }),
    supabase.from("contrato_equipe_bling").select("bling_pedido_id, sdr_id, closer_id"),
    supabase.from("profiles").select("user_id, nome"),
  ]);
  if (error) console.error("[academy] vendas:", error.message);
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  const equipe = new Map((equipes ?? []).map((e) => [e.bling_pedido_id, e]));
  const pessoa = (id: string | null | undefined) => (id ? (nome.get(id) ?? null) : null);

  // Cada pedido vira uma venda por curso (só itens que são curso).
  const pedidos = (data ?? [])
    .map((v) => ({
      ...v,
      cancelado: pedidoBlingCancelado(v.situacao_id, v.situacao_valor),
      itens: itensDoPedido(v.produto ?? "")
        .map((item) => {
          const curso = nomePadronizado(item);
          const categoria = classificarProdutoAcademy(item);
          // Curso: categoria pelo nome padronizado (o item pode vir como "especializacao-analise-…").
          return { item, curso, categoria: categoria === "especializacao" || categoria === "livre" ? classificarProdutoAcademy(curso) : categoria };
        })
        .filter((i): i is typeof i & { categoria: CategoriaVendaAcademy } => ehVenda(i.categoria)),
    }))
    .filter((v) => v.itens.length > 0)
    .filter((v, _, todos) => !duplicado(v, todos));

  // Grafias diferentes do mesmo curso (só maiúsculas/pontuação): fica a mais frequente.
  const grafias = new Map<string, Map<string, number>>();
  for (const p of pedidos)
    for (const i of p.itens) {
      const porGrafia = grafias.get(slugCurso(i.curso)) ?? new Map<string, number>();
      porGrafia.set(i.curso, (porGrafia.get(i.curso) ?? 0) + 1);
      grafias.set(slugCurso(i.curso), porGrafia);
    }
  const grafiaPadrao = new Map([...grafias].map(([slug, porGrafia]) => [slug, [...porGrafia].sort((a, b) => b[1] - a[1])[0][0]]));
  for (const p of pedidos) for (const i of p.itens) i.curso = grafiaPadrao.get(slugCurso(i.curso))!;

  // Ticket médio de cada curso, pelas vendas avulsas válidas (pedido com um curso só).
  const avulsas = new Map<string, number[]>();
  for (const p of pedidos) if (!p.cancelado && p.itens.length === 1) avulsas.set(p.itens[0].curso, [...(avulsas.get(p.itens[0].curso) ?? []), Number(p.total)]);
  const ticketMedio = new Map([...avulsas].map(([curso, valores]) => [curso, valores.reduce((s, v) => s + v, 0) / valores.length]));

  const linhas = pedidos.flatMap((p) => {
    const valores = p.itens.length === 1 ? [Number(p.total)] : ratearPedido(Number(p.total), p.itens.map((i) => i.curso), ticketMedio);
    return p.itens.map((i, n) => ({ pedido: p, ...i, valor: valores[n] }));
  });
  // Edições pelas vendas válidas; a cancelada vai para a edição mais próxima.
  const validas = linhas.filter((l) => !l.pedido.cancelado);
  const nomesValidas = edicoes(validas.map((l) => ({ curso: l.curso, data: l.pedido.data! })));
  const edicaoDaLinha = new Map(validas.map((l, n) => [l, nomesValidas[n]]));
  const conhecidas = new Map<string, { curso: string; nome: string; primeira: string; ultima: string }>();
  validas.forEach((l, n) => {
    const e = conhecidas.get(nomesValidas[n]) ?? { curso: l.curso, nome: nomesValidas[n], primeira: l.pedido.data!, ultima: l.pedido.data! };
    if (l.pedido.data! < e.primeira) e.primeira = l.pedido.data!;
    if (l.pedido.data! > e.ultima) e.ultima = l.pedido.data!;
    conhecidas.set(e.nome, e);
  });
  for (const l of linhas) if (l.pedido.cancelado) edicaoDaLinha.set(l, edicaoDeCancelada(l.curso, l.pedido.data!, [...conhecidas.values()]));

  const todas: VendaAcademy[] = linhas
    .map((l) => {
      const p = l.pedido;
      const total = Number(p.total);
      const f = total > 0 ? l.valor / total : 1 / p.itens.length;
      const taxaEstimada = (p.pagamentos ?? []).reduce((s, pg) => s + (pg.valor * pg.aliquota) / 100 + pg.taxaFixa, 0);
      const taxaPedido = p.taxa_real ?? taxaEstimada;
      const taxa = arred(taxaPedido * f);
      const impostos = arred(l.valor * ALIQUOTA_IMPOSTOS_ACADEMY);
      const curso = edicaoDaLinha.get(l)!;
      return {
        blingPedidoId: p.bling_pedido_id,
        numeroPedido: p.numero,
        cliente: p.contato_nome ?? "—",
        documentoMascarado: mascararDocumento(p.contato_documento),
        curso,
        cursoSlug: slugCurso(curso),
        produto: l.item,
        categoria: l.categoria,
        situacao: p.cancelado ? "cancelado" : p.situacao_id === 9 ? "atendido" : "em_aberto",
        dataVenda: p.data!,
        valorTotal: l.valor,
        valorPedido: total,
        rateado: p.itens.length > 1,
        pagamentos: pagamentosDaVenda(p.pagamentos, taxaPedido, f),
        taxa,
        taxaReal: p.taxa_real !== null,
        impostos,
        liquido: arred(l.valor - taxa - impostos),
        sdr: pessoa(equipe.get(p.bling_pedido_id)?.sdr_id),
        closer: pessoa(equipe.get(p.bling_pedido_id)?.closer_id),
      } satisfies VendaAcademy;
    })
    .sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || Number(b.numeroPedido) - Number(a.numeroPedido));
  const vendas = todas.filter((v) => v.situacao !== "cancelado");

  const doPeriodo = (periodo: PeriodoVendasAcademy) => {
    const inicio = inicioDoMes(hoje, -(MESES[periodo] - 1));
    return vendas.filter((v) => v.dataVenda >= inicio && v.dataVenda <= hoje);
  };
  /** Cursos com venda no período, do maior valor vendido no período para o menor. */
  const cursosDoPeriodo = (periodo: PeriodoVendasAcademy) =>
    agruparCursos(vendas, doPeriodo(periodo))
      .filter((c) => c.vendasPeriodo > 0)
      .sort((a, b) => b.valorPeriodo - a.valorPeriodo || b.vendasPeriodo - a.vendasPeriodo);
  /** Curso pelo slug da URL: vendas válidas e canceladas, da mais recente para a mais antiga. */
  const curso = (slug: string) => {
    const resumo = agruparCursos(vendas, []).find((c) => c.slug === slug);
    return resumo
      ? { ...resumo, vendas: vendas.filter((v) => v.cursoSlug === slug), canceladas: todas.filter((v) => v.situacao === "cancelado" && v.cursoSlug === slug) }
      : null;
  };
  /** Todos os cursos em ordem alfabética (edições do mesmo curso, da mais antiga para a mais recente) — seletor da tela do curso. */
  const listaCursos = () =>
    agruparCursos(vendas, [])
      .sort((a, b) => a.nome.split(" · ")[0].localeCompare(b.nome.split(" · ")[0], "pt-BR") || a.primeiraVenda.localeCompare(b.primeiraVenda))
      .map((c) => ({ slug: c.slug, nome: c.nome }));
  const sincronizadoEm = (data ?? []).reduce<string | null>((max, v) => (!max || v.sincronizado_em > max ? v.sincronizado_em : max), null);
  return { doPeriodo, cursosDoPeriodo, curso, listaCursos, sincronizadoEm, temCache: (data ?? []).length > 0 };
}

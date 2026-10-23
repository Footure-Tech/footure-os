import type { SupabaseClient } from "@supabase/supabase-js";
import type { CobrancaClienteRow, CobrancaEnvioItemRow, CobrancaEnvioRow, Database } from "@/lib/supabase/database.types";
import { carregarBaseParcelas } from "@/lib/financeiro/carteira";
import { carregarConfiguracaoCobranca } from "./regua";
import { boletosDasParcelas } from "./boletos";
import { diasDesdeVencimento, hojeBrt, normalizarEmails } from "./regras";

type Supa = SupabaseClient<Database>;

export type AbaCobranca = "aprovacao" | "historico" | "clientes" | "configuracao";

export interface BoletoTela {
  codigo: string;
  situacao: string;
  nossoNumero: string | null;
}

export interface EnvioTela extends CobrancaEnvioRow {
  cliente: string;
  itens: CobrancaEnvioItemRow[];
  total: number;
  /** F2: boleto do Inter de cada parcela do envio (só nos aguardando aprovação). */
  boletos: Record<number, BoletoTela>;
}

export interface ClienteCobranca {
  contatoId: number;
  nome: string;
  emAberto: number;
  atrasado: number;
  maiorAtraso: number;
  proximoVencimento: string | null;
  emails: string[];
  /** Origem dos destinatários: observações internas do pedido ou cadastro do contato no Bling. */
  origemEmails: "pedido" | "contato";
  regra: CobrancaClienteRow | null;
  ultimoEnvio: Pick<CobrancaEnvioRow, "tipo" | "status" | "enviado_em" | "entrega"> | null;
}

/** Dados da tela /financeiro/cobranca. */
export async function carregarTelaCobranca(supabase: Supa) {
  const hoje = hojeBrt();
  const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [config, base, { data: envios }, { data: regras }, { data: emailsPedidos }] = await Promise.all([
    carregarConfiguracaoCobranca(supabase),
    carregarBaseParcelas(supabase),
    supabase.from("cobranca_envios").select("*, itens:cobranca_envio_itens(*)").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(500),
    supabase.from("cobranca_clientes").select("*"),
    supabase.from("cobranca_pedidos_emails").select("bling_pedido_id, emails"),
  ]);
  const emailsDoPedido = new Map((emailsPedidos ?? []).map((p) => [p.bling_pedido_id, p.emails]));

  const paraTela = (e: CobrancaEnvioRow & { itens: CobrancaEnvioItemRow[] }): EnvioTela => ({
    ...e,
    cliente: base.nomeDoContato(e.contato_id),
    itens: [...e.itens].sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    total: e.itens.reduce((s, i) => s + Number(i.valor), 0),
    boletos: {},
  });
  // Itens aninhados pela FK envio_id (os tipos à mão não descrevem relações).
  const todos = ((envios ?? []) as unknown as (CobrancaEnvioRow & { itens: CobrancaEnvioItemRow[] })[]).map(paraTela);
  const aguardando = todos.filter((e) => e.status === "pendente" || e.status === "erro");
  const boletos = await boletosDasParcelas(supabase, aguardando.flatMap((e) => e.itens.map((i) => i.parcela_id)));
  for (const e of aguardando)
    for (const i of e.itens) {
      const b = boletos.get(i.parcela_id);
      if (b) e.boletos[i.parcela_id] = { codigo: b.codigo_solicitacao, situacao: b.situacao, nossoNumero: b.nosso_numero };
    }
  const historico = todos.filter((e) => e.status !== "pendente");
  const problemasEntrega = historico.filter((e) => e.entrega === "devolvido" || e.entrega === "spam");

  // Clientes com parcelas em aberto (o que a régua acompanha).
  const regraDe = new Map((regras ?? []).map((r) => [r.contato_id, r]));
  const ultimoDe = new Map<number, EnvioTela>();
  for (const e of todos) if (e.tipo !== "escalonamento" && e.status === "enviado" && !ultimoDe.has(e.contato_id)) ultimoDe.set(e.contato_id, e);
  const porContato = new Map<number, ClienteCobranca>();
  for (const p of base.parcelas) {
    if ((p.situacao !== "em_aberto" && p.situacao !== "atrasada") || base.deCancelado(p)) continue;
    const regra = regraDe.get(p.contatoId) ?? null;
    const c = porContato.get(p.contatoId) ?? {
      contatoId: p.contatoId,
      nome: base.nomeDoContato(p.contatoId),
      emAberto: 0,
      atrasado: 0,
      maiorAtraso: 0,
      proximoVencimento: null,
      emails: [],
      origemEmails: "contato",
      regra,
      ultimoEnvio: ultimoDe.get(p.contatoId) ?? null,
    };
    const pedidoId = p.numeroPedidoOrigem ? base.pedidoPorChave.get(`${p.contatoId}:${p.numeroPedidoOrigem}`)?.id : undefined;
    const doPedido = pedidoId ? emailsDoPedido.get(pedidoId) : undefined;
    if (doPedido?.length) {
      c.emails = normalizarEmails(c.origemEmails === "pedido" ? c.emails : [], doPedido);
      c.origemEmails = "pedido";
    }
    c.emAberto += p.valor;
    const dias = diasDesdeVencimento(p.vencimento, hoje);
    if (dias > 0) {
      c.atrasado += p.valor;
      c.maiorAtraso = Math.max(c.maiorAtraso, dias);
    } else if (!c.proximoVencimento || p.vencimento < c.proximoVencimento) c.proximoVencimento = p.vencimento;
    porContato.set(p.contatoId, c);
  }
  for (const c of porContato.values()) {
    const extras = c.regra?.destinatarios_extra ?? [];
    c.emails = c.origemEmails === "pedido" ? normalizarEmails(c.emails, extras) : normalizarEmails(c.regra?.email_bling, c.regra?.email_nf_bling, extras);
  }
  const clientes = [...porContato.values()].sort((a, b) => b.maiorAtraso - a.maiorAtraso || a.nome.localeCompare(b.nome));

  return { config, aguardando, historico, problemasEntrega, clientes, hoje, temCache: base.temCache };
}

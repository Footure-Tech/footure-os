// Carregamento das telas da Controladoria (0061). Lê só o cache — nunca o Bling ao vivo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinAlertaEventoRow, FinAlertaRow } from "@/lib/supabase/database.types";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { calcularDre, type RegimeDre } from "./dre";
import { calcularFluxoCaixa, type CenarioCaixa } from "./fluxoCaixa";
import { calcularAgenda, calcularCaixa, calcularContasAPagar, calcularMes, calcularMrr, calcularRecebiveis, calcularSaude, carregarBaseControladoria } from "./indicadores";

type Supa = SupabaseClient<Database>;

const ORDEM: Record<FinAlertaRow["severidade"], number> = { critico: 0, atencao: 1, info: 2 };
const porGravidade = (a: FinAlertaRow, b: FinAlertaRow) => ORDEM[a.severidade] - ORDEM[b.severidade] || (b.valor ?? 0) - (a.valor ?? 0);
/** Aberto = novo, em tratamento ou adiado cujo prazo já chegou. */
export const alertaAberto = (a: Pick<FinAlertaRow, "status" | "adiado_ate">, hoje = hojeLocal()) =>
  a.status === "novo" || a.status === "em_tratamento" || (a.status === "adiado" && (!a.adiado_ate || a.adiado_ate <= hoje));

export async function carregarPainel(supabase: Supa) {
  const hoje = hojeLocal();
  const [base, mrr, { data: alertas }] = await Promise.all([
    carregarBaseControladoria(supabase),
    calcularMrr(supabase, hoje),
    supabase.from("fin_alertas").select("*").in("status", ["novo", "em_tratamento", "adiado"]),
  ]);
  const abertos = (alertas ?? []).filter((a) => alertaAberto(a, hoje)).sort(porGravidade);
  return {
    hoje,
    caixa: calcularCaixa(base, hoje),
    recebiveis: calcularRecebiveis(base, hoje),
    mes: calcularMes(base, hoje),
    agenda: calcularAgenda(base, hoje, 7),
    saude: calcularSaude(base, hoje),
    premissas: base.premissas,
    mrr,
    alertas: abertos,
  };
}

export async function carregarTelaPagar(supabase: Supa) {
  const hoje = hojeLocal();
  const base = await carregarBaseControladoria(supabase);
  return { hoje, ...calcularContasAPagar(base, hoje) };
}

export type AbaAlertas = "abertos" | "adiados" | "encerrados" | "resolvidos";

export async function carregarTelaAlertas(supabase: Supa, aba: AbaAlertas) {
  const hoje = hojeLocal();
  // Só a data: o "." dos milissegundos quebraria o filtro or() do PostgREST.
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: todos, error }, { data: pessoas }] = await Promise.all([
    supabase.from("fin_alertas").select("*").or(`status.neq.resolvido,resolvido_em.gte.${desde}`),
    supabase.from("profiles").select("user_id, nome, papel").eq("ativo", true).in("papel", ["admin", "financeiro"]).order("nome"),
  ]);
  if (error) throw new Error(error.message);
  const lista = todos ?? [];
  const grupos: Record<AbaAlertas, FinAlertaRow[]> = {
    abertos: lista.filter((a) => alertaAberto(a, hoje)).sort(porGravidade),
    adiados: lista.filter((a) => a.status === "adiado" && !alertaAberto(a, hoje)).sort((a, b) => (a.adiado_ate ?? "").localeCompare(b.adiado_ate ?? "")),
    encerrados: lista.filter((a) => a.status === "encerrado").sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em)),
    resolvidos: lista.filter((a) => a.status === "resolvido").sort((a, b) => (b.resolvido_em ?? "").localeCompare(a.resolvido_em ?? "")),
  };
  const visiveis = grupos[aba];
  const eventos = new Map<string, FinAlertaEventoRow[]>();
  for (let i = 0; i < visiveis.length; i += 100) {
    const { data } = await supabase
      .from("fin_alerta_eventos")
      .select("*")
      .in("alerta_id", visiveis.slice(i, i + 100).map((a) => a.id))
      .order("criado_em", { ascending: false });
    for (const e of data ?? []) eventos.set(e.alerta_id, [...(eventos.get(e.alerta_id) ?? []), e]);
  }
  const nomes = new Map((pessoas ?? []).map((p) => [p.user_id, p.nome]));
  return {
    hoje,
    contagens: { abertos: grupos.abertos.length, adiados: grupos.adiados.length, encerrados: grupos.encerrados.length, resolvidos: grupos.resolvidos.length },
    alertas: visiveis.map((a) => ({
      ...a,
      responsavel: a.responsavel_id ? (nomes.get(a.responsavel_id) ?? "—") : null,
      eventos: (eventos.get(a.id) ?? []).slice(0, 5).map((e) => ({ ...e, autor: e.autor_id ? (nomes.get(e.autor_id) ?? "—") : null })),
    })),
    pessoas: (pessoas ?? []).map((p) => ({ id: p.user_id, nome: p.nome })),
  };
}

export async function carregarTelaPremissas(supabase: Supa) {
  const hoje = hojeLocal();
  const base = await carregarBaseControladoria(supabase);
  // Uso de cada conta nos últimos 90 dias: ajuda a decidir a camada.
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const uso = new Map<number, number>();
  for (const l of base.lancamentos) if (l.conta_financeira_id && l.vencimento >= desde) uso.set(l.conta_financeira_id, (uso.get(l.conta_financeira_id) ?? 0) + 1);
  return {
    hoje,
    premissas: base.premissas,
    contas: base.contas.map((c) => ({ ...c, usoRecente: uso.get(c.id) ?? 0 })).sort((a, b) => b.usoRecente - a.usoRecente || a.descricao.localeCompare(b.descricao)),
  };
}

export async function carregarTelaDre(supabase: Supa, regime: RegimeDre) {
  const base = await carregarBaseControladoria(supabase);
  return { ...calcularDre(base, regime), pendentesDetalhe: base.pendentesDetalhe };
}

export async function carregarTelaCaixa(supabase: Supa, cenario: CenarioCaixa) {
  const base = await carregarBaseControladoria(supabase);
  return calcularFluxoCaixa(base, cenario);
}

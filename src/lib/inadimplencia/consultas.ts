// Inadimplência a partir do cache do Bling (bling_parcelas, 0030) — antes
// buscava as parcelas atrasadas de cada cliente ao vivo no Bling. Mesma base
// da tela Financeiro (carregarBaseParcelas).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { carregarBaseParcelas, hojeLocal, montarContratosDaBase } from "@/lib/financeiro/carteira";

type Supa = SupabaseClient<Database>;

/**
 * Régua de cobrança sugerida pelo handoff. Ainda NÃO há envio automático nem
 * registro de contato: a tela mostra só a etapa que caberia pelos dias de
 * atraso, como orientação.
 */
export const ETAPAS_REGUA = [
  { dias: 3, rotulo: "D+3 · e-mail automático" },
  { dias: 15, rotulo: "D+15 · WhatsApp" },
  { dias: 30, rotulo: "D+30 · contato do financeiro" },
  { dias: 60, rotulo: "D+60 · notificação extrajudicial" },
] as const;

export function etapaReguaSugerida(diasAtraso: number): { indice: number; rotulo: string } {
  let indice = -1;
  ETAPAS_REGUA.forEach((e, i) => {
    if (diasAtraso >= e.dias) indice = i;
  });
  return indice < 0 ? { indice, rotulo: "Antes do D+3" } : { indice, rotulo: ETAPAS_REGUA[indice].rotulo };
}

export const FAIXAS_ATRASO = [
  { rotulo: "1–30 dias", ate: 30, cor: "bg-orange" },
  { rotulo: "31–60 dias", ate: 60, cor: "bg-orange2" },
  { rotulo: "61–90 dias", ate: 90, cor: "bg-red" },
  { rotulo: "+90 dias", ate: Infinity, cor: "bg-[#b71c1c]" },
] as const;

function diasEntre(deIso: string, ateIso: string) {
  const [a1, m1, d1] = deIso.split("-").map(Number);
  const [a2, m2, d2] = ateIso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export interface ClienteInadimplente {
  contatoId: number;
  clienteId: string | null;
  nome: string;
  logoPath: string | null;
  pedidosBling: string[];
  totalAtrasado: number;
  parcelasAtrasadas: number;
  vencidoDesde: string;
  diasAtraso: number;
}

export type FiltroContratosInadimplencia = "todos" | "ativos";

/**
 * `base` opcional: quem já carregou o cache (ex.: Dashboard) evita ler de novo.
 * `filtro = "ativos"`: só parcelas de contratos ativos — vigência em curso,
 * mesmo critério de Financeiro · Contratos (parcela avulsa, sem pedido de
 * origem, fica de fora). Todos os números (KPIs, faixas, lista) seguem o filtro.
 */
export async function carregarInadimplencia(supabase: Supa, base?: Awaited<ReturnType<typeof carregarBaseParcelas>>, filtro: FiltroContratosInadimplencia = "todos") {
  const baseCarregada = base ?? (await carregarBaseParcelas(supabase));
  const { clientePorContato, nomeDoContato, sincronizadoEm, temCache } = baseCarregada;
  const hoje = hojeLocal();
  const ativos = filtro === "ativos" ? new Set(montarContratosDaBase(baseCarregada, hoje).filter((c) => c.ativo).map((c) => `${c.contatoId}:${c.numeroPedido}`)) : null;
  const parcelas = ativos
    ? baseCarregada.parcelas.filter((p) => !!p.numeroPedidoOrigem && ativos.has(`${p.contatoId}:${p.numeroPedidoOrigem}`))
    : baseCarregada.parcelas;
  const vencidas = parcelas.filter((p) => p.situacao === "atrasada");
  const aVencer = parcelas.filter((p) => p.situacao === "em_aberto");

  const porContato = new Map<number, typeof vencidas>();
  for (const p of vencidas) porContato.set(p.contatoId, [...(porContato.get(p.contatoId) ?? []), p]);

  const clientes: ClienteInadimplente[] = [...porContato].map(([contatoId, lista]) => {
    const maisAntiga = lista.reduce((min, p) => (p.vencimento < min ? p.vencimento : min), lista[0].vencimento);
    const local = clientePorContato.get(contatoId);
    return {
      contatoId,
      clienteId: local?.id ?? null,
      nome: nomeDoContato(contatoId),
      logoPath: local?.logo_path ?? null,
      pedidosBling: [...new Set(lista.map((p) => p.numeroPedidoOrigem).filter((n): n is string => !!n))],
      totalAtrasado: lista.reduce((s, p) => s + p.valor, 0),
      parcelasAtrasadas: lista.length,
      vencidoDesde: maisAntiga,
      diasAtraso: diasEntre(maisAntiga, hoje),
    };
  });
  // Mais atrasado primeiro (coluna "Dias ↓" do handoff); empate pelo valor.
  clientes.sort((a, b) => b.diasAtraso - a.diasAtraso || b.totalAtrasado - a.totalAtrasado);

  // Faixas pelo atraso de CADA parcela (não do cliente); clientes = quantos têm parcela na faixa.
  const faixas = FAIXAS_ATRASO.map((f, i) => {
    const de = i === 0 ? 1 : FAIXAS_ATRASO[i - 1].ate + 1;
    const naFaixa = vencidas.filter((p) => {
      const dias = diasEntre(p.vencimento, hoje);
      return dias >= de && dias <= f.ate;
    });
    return { ...f, valor: naFaixa.reduce((s, p) => s + p.valor, 0), clientes: new Set(naFaixa.map((p) => p.contatoId)).size };
  });

  const totalVencido = vencidas.reduce((s, p) => s + p.valor, 0);
  // Recuperado no mês = parcelas pagas NESTE mês depois do vencimento (baixa do borderô, 0032).
  const mesAtual = hoje.slice(0, 7);
  const recuperadas = parcelas.filter(
    (p) => (p.situacao === "recebida" || p.situacao === "recebida_parcial") && p.dataPagamento?.startsWith(mesAtual) && p.dataPagamento > p.vencimento,
  );
  const temDataDeBaixa = parcelas.some((p) => p.dataPagamento);
  const totalAVencer = aVencer.reduce((s, p) => s + p.valor, 0);
  return {
    temCache,
    sincronizadoEm,
    clientes,
    faixas,
    resumo: {
      totalVencido,
      parcelasVencidas: vencidas.length,
      // Taxa = vencido ÷ tudo que está em aberto (vencido + a vencer).
      taxa: totalVencido + totalAVencer > 0 ? totalVencido / (totalVencido + totalAVencer) : 0,
      clientes: clientes.length,
      clientesAtivos: new Set([...vencidas, ...aVencer].map((p) => p.contatoId)).size,
      recuperadoMes: temDataDeBaixa ? recuperadas.reduce((s, p) => s + (p.valorPago ?? p.valor), 0) : null,
      parcelasRecuperadas: recuperadas.length,
    },
  };
}

// Regras de classificação da Controladoria (0061), sem acesso a banco: usadas
// pela sincronização, pelos indicadores, pelo motor de alertas e pelas telas.
import type { CamadaContaFinanceira, FinCategoriaRow } from "@/lib/supabase/database.types";

export const SITUACAO_EM_ABERTO = 1;
export const SITUACAO_PAGA = 2;
export const SITUACAO_PARCIAL = 3;
export const SITUACAO_CANCELADA = 5;
/** Devolvida (4) e cancelada (5) não entram em fluxo nenhum. */
export const situacaoValida = (situacao: number) => situacao !== 4 && situacao !== SITUACAO_CANCELADA;
export const emAberto = (situacao: number) => situacao === SITUACAO_EM_ABERTO || situacao === SITUACAO_PARCIAL;

export const ROTULO_CAMADA: Record<CamadaContaFinanceira, string> = {
  disponivel: "Disponível",
  liquidez: "Liquidez em 1 dia",
  aplicacao: "Aplicação",
  gateway: "A liquidar (gateway)",
  cartao: "Cartão de crédito",
  ignorar: "Fora do caixa",
};
export const DESCRICAO_CAMADA: Record<CamadaContaFinanceira, string> = {
  disponivel: "Conta corrente e caixa: dinheiro que pode sair hoje.",
  liquidez: "Fundos com resgate em até 1 dia (reserva). Entra no colchão.",
  aplicacao: "Aplicações com prazo de resgate maior. Entra só no runway.",
  gateway: "Vendas no cartão/Pix de gateways ainda não repassadas.",
  cartao: "Fatura de cartão de crédito (dívida, não caixa).",
  ignorar: "Conta antiga ou que não representa dinheiro da empresa.",
};
/** Camadas que formam o "caixa disponível" (e o colchão). */
export const CAMADAS_CAIXA: CamadaContaFinanceira[] = ["disponivel", "liquidez"];

/** Camada sugerida para uma conta nova do Bling, pelo nome — a Diretoria ajusta em Premissas. */
export function camadaSugerida(descricao: string): CamadaContaFinanceira {
  const d = descricao.toLowerCase();
  if (!d.trim()) return "ignorar";
  if (/cart[aã]o de cr[eé]dito/.test(d) && !/cdb/.test(d)) return "cartao";
  if (/resgate 24h|liquidez di[aá]ria/.test(d)) return "liquidez";
  if (/cdb|firf|fundo|binance|pagcripto/.test(d)) return "aplicacao";
  if (/pagar\.me|stripe|infinitepay|interpag|stone|vindi|pagseguro|paypal|mercado pago|hotmart|bling conta|conta azul/.test(d)) return "gateway";
  if (/conta corrente|^caixa$/.test(d)) return "disponivel";
  return "ignorar";
}

// Raízes do plano de contas que não são entrada nem saída de verdade
// (movimento entre contas da própria empresa) — ficam fora de todo fluxo.
const RAIZES_INTERNAS = new Set(["transferências", "transferências de entrada", "transferências de saída", "ajuste de saldo", "ajustes de caixa", "depósitos"]);
const RAIZES_EMPRESTIMO = new Set(["empréstimos recebidos", "amortização de empréstimos", "juros e encargos de empréstimos"]);

export interface InfoCategoria {
  caminho: string;
  raiz: string;
  /** Transferência/ajuste entre contas: fora dos fluxos. */
  interna: boolean;
  /** Empréstimo tomado ou pago: entra no caixa, não é receita nem despesa operacional. */
  emprestimo: boolean;
  distribuicaoLucros: boolean;
  faturaCartao: boolean;
}

export function mapaDeCategorias(categorias: Pick<FinCategoriaRow, "id" | "id_pai" | "descricao">[]) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const cache = new Map<number, InfoCategoria>();
  return (id: number | null): InfoCategoria | null => {
    if (!id) return null;
    const pronta = cache.get(id);
    if (pronta) return pronta;
    const partes: string[] = [];
    const vistos = new Set<number>();
    for (let c = porId.get(id); c && !vistos.has(c.id); c = c.id_pai ? porId.get(c.id_pai) : undefined) {
      vistos.add(c.id);
      partes.unshift(c.descricao.trim());
    }
    if (!partes.length) return null;
    const caminho = partes.join(" › ");
    const raiz = partes[0].toLowerCase();
    const info: InfoCategoria = {
      caminho,
      raiz: partes[0],
      interna: RAIZES_INTERNAS.has(raiz),
      emprestimo: RAIZES_EMPRESTIMO.has(raiz),
      distribuicaoLucros: /distribui[cç][aã]o de lucros/i.test(caminho),
      faturaCartao: /cart[aã]o (de )?cr[eé]dito/i.test(caminho) && /compras de fornecedores/i.test(caminho),
    };
    cache.set(id, info);
    return info;
  };
}

/** Formas de pagamento cobradas pelo gateway (cartão, Hotmart, link): não precisam de boleto/Pix emitido à parte. */
export function formaSemCobrancaManual(tipoPagamento: number | null, descricao: string) {
  return tipoPagamento === 3 || /hotmart|cart[aã]o|link de pagamento|d[eé]bito autom[aá]tico/i.test(descricao);
}

export function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** "2026-10" → mês anterior/seguinte. */
export function deslocarMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

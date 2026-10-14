// Formatação de exibição compartilhada pelas telas do redesign (módulo
// neutro: serve a Server e Client Components).
import type { FormaPagamento, MeioPagamento } from "@/lib/supabase/database.types";
import { ROTULO_MEIO_PAGAMENTO } from "@/lib/contratos/meioPagamento";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number | null | undefined): string {
  return MOEDA.format(valor ?? 0);
}

/** "2026-10-14" ou ISO completo -> "14/10/26". Datas puras (aaaa-mm-dd) são
 * lidas como texto pra não sofrer o deslocamento de fuso do parse em UTC. */
export function formatarDataCurta(iso: string): string {
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  if (soData) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano.slice(2)}`;
  }
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** "Boleto · 12x" / "PIX · à vista" (coluna Pagamento do handoff). */
export function rotuloPagamento(forma: FormaPagamento, meio: MeioPagamento, numeroParcelas: number | null): string {
  const meioRotulo = ROTULO_MEIO_PAGAMENTO[meio];
  return forma === "parcelado" && numeroParcelas ? `${meioRotulo} · ${numeroParcelas}x` : `${meioRotulo} · à vista`;
}

/** Meses inteiros entre duas datas aaaa-mm-dd (vigência do contrato). */
export function mesesEntre(inicio: string, fim: string): number | null {
  if (!inicio || !fim) return null;
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  // Fim no dia anterior ao aniversário (ex.: 01/01 -> 31/12) ainda conta o mês cheio.
  if (d2 + 1 < d1) meses -= 1;
  return meses > 0 ? meses : null;
}

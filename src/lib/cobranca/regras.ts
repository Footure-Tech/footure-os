// Regras puras da régua de cobrança (sem banco nem API) — ver regua.ts.
import type { TipoEnvioCobranca } from "@/lib/supabase/database.types";

/** Atraso máximo para uma etapa perdida ainda sair (cron que falhou um ou dois dias). */
export const JANELA_RECUPERACAO_DIAS = 2;

/** Data de hoje em Brasília (aaaa-mm-dd) — o servidor da Vercel roda em UTC. */
export function hojeBrt(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Dias de `vencimento` até `hoje` (negativo = ainda vai vencer). */
export function diasDesdeVencimento(vencimento: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${vencimento}T00:00:00Z`)) / 86_400_000);
}

/**
 * Etapa da régua que vence hoje para uma parcela, ou null. Só a etapa mais
 * recente dentro da janela de recuperação: se o cron falhou e duas etapas se
 * acumularam, sai a mais nova (não manda o lembrete atrasado junto com a
 * cobrança). Etapa já enviada → null.
 */
export function etapaDoDia(regua: number[], dias: number, jaEnviadas: Set<number>): number | null {
  const devidas = regua.filter((e) => e <= dias && dias - e <= JANELA_RECUPERACAO_DIAS);
  if (devidas.length === 0) return null;
  const etapa = Math.max(...devidas);
  return jaEnviadas.has(etapa) ? null : etapa;
}

export function tipoDaEtapa(etapa: number): Exclude<TipoEnvioCobranca, "escalonamento"> {
  return etapa < 0 ? "lembrete" : etapa === 0 ? "vencimento" : "atraso";
}

/** O mais "grave" decide o tipo do e-mail que reúne várias parcelas. */
export function tipoDoEnvio(etapas: number[]): Exclude<TipoEnvioCobranca, "escalonamento"> {
  return tipoDaEtapa(Math.max(...etapas));
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Junta listas de e-mails (campos do Bling podem trazer vários, separados por vírgula ou ponto e vírgula). */
export function normalizarEmails(...listas: (string | null | undefined | string[])[]): string[] {
  const todos = listas.flatMap((l) => (Array.isArray(l) ? l : l ? [l] : [])).flatMap((t) => t.split(/[,;\s]+/));
  return [...new Set(todos.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e)))];
}

/** Régua digitada ("-3, 0, 1, 5") → dias únicos em ordem; null se inválida. */
export function lerRegua(texto: string): number[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean);
  if (partes.length === 0) return null;
  const dias = partes.map((p) => Number(p.replace(/^D/i, "")));
  if (dias.some((d) => !Number.isInteger(d) || d < -30 || d > 60)) return null;
  return [...new Set(dias)].sort((a, b) => a - b);
}

/** "D-3" / "D0" / "D+5". */
export function rotuloEtapa(etapa: number): string {
  return etapa === 0 ? "D0" : etapa < 0 ? `D${etapa}` : `D+${etapa}`;
}

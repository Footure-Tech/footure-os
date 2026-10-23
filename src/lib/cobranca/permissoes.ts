import type { PapelUsuario } from "@/lib/supabase/database.types";

/** Quem opera a régua de cobrança (tela, aprovação, configuração) — mesmo critério das policies de 0059. */
export const PAPEIS_COBRANCA: PapelUsuario[] = ["admin", "financeiro"];

import type { PapelUsuario } from "@/lib/supabase/database.types";

// Nome de exibição de cada papel na linguagem do handoff (Footure Gestão).
// O enum do banco continua o mesmo; o perfil "Financeiro" do handoff não
// existe — as telas financeiras ficam sob o admin (Diretoria).
export const ROTULO_PERFIL: Record<PapelUsuario, string> = {
  admin: "Diretoria",
  vendedor: "Comercial",
  juridico: "Jurídico",
  marketing: "Marketing",
};

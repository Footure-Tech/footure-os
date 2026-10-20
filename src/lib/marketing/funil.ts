// Visão Funil do Marketing: estágios padrão (0054) que unificam as etapas dos
// funis do Kommo, na ordem do funil. Ganho e perdido são desfechos, não degraus.
import type { EstagioFunil } from "@/lib/supabase/database.types";

export const ESTAGIOS_FUNIL: EstagioFunil[] = ["entrada", "tentativa", "conectado", "qualificado", "oferta", "negociacao", "ganho", "perdido"];

export const ROTULO_ESTAGIO: Record<EstagioFunil, string> = {
  entrada: "Entrada",
  tentativa: "Tentativa de contato",
  conectado: "Conectado",
  qualificado: "Qualificado (MQL)",
  oferta: "Reunião / Oferta",
  negociacao: "Negociação (SQL)",
  ganho: "Ganho",
  perdido: "Perdido",
};

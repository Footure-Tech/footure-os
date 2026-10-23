import type { GrupoAlerta, SeveridadeAlerta, StatusAlerta } from "@/lib/supabase/database.types";
import type { TomStatus } from "@/lib/status/visual";

export const SEVERIDADE_VISUAL: Record<SeveridadeAlerta, { rotulo: string; tom: TomStatus }> = {
  critico: { rotulo: "Crítico", tom: "inactive" },
  atencao: { rotulo: "Atenção", tom: "pending" },
  info: { rotulo: "Info", tom: "in_progress" },
};

export const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = { critico: 0, atencao: 1, info: 2 };

export const ROTULO_GRUPO: Record<GrupoAlerta, string> = {
  caixa: "Caixa",
  pagamentos: "Pagamentos",
  recebiveis: "Recebíveis",
  integracao: "Integração",
};

export const STATUS_ALERTA_VISUAL: Record<StatusAlerta, { rotulo: string; tom: TomStatus }> = {
  novo: { rotulo: "Novo", tom: "pending" },
  em_tratamento: { rotulo: "Em tratamento", tom: "in_progress" },
  adiado: { rotulo: "Adiado", tom: "not_started" },
  encerrado: { rotulo: "Encerrado", tom: "not_started" },
  resolvido: { rotulo: "Resolvido", tom: "completed" },
};

// Links e tons compartilhados pelas telas do Marketing (Visão A, detalhe e Visão B).
import type { BuMarketing } from "@/lib/supabase/database.types";
import type { FiltroMarketing, Granularidade } from "@/lib/marketing/consultas";

export const TOM_BU: Record<BuMarketing, "info" | "purple"> = { academy: "info", footlink: "purple" };

/** URL da Visão A com os filtros (os padrões ficam fora da URL; a BU vem do contexto da AppBar). */
export function hrefDesempenho(f: FiltroMarketing) {
  const p = new URLSearchParams();
  if (f.periodo !== "90d") p.set("periodo", f.periodo);
  if (f.campanha) p.set("campanha", f.campanha);
  const qs = p.toString();
  return qs ? `/marketing?${qs}` : "/marketing";
}

/** URL da Visão B com os filtros (os padrões ficam fora da URL). */
export function hrefRetorno(f: FiltroMarketing, g: Granularidade) {
  const p = new URLSearchParams();
  if (f.periodo !== "90d") p.set("periodo", f.periodo);
  if (f.campanha) p.set("campanha", f.campanha);
  if (g !== "mes") p.set("granularidade", g);
  const qs = p.toString();
  return qs ? `/marketing/retorno?${qs}` : "/marketing/retorno";
}

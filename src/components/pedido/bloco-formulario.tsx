import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Seção de formulário do handoff (card branco, padding 24, título 18/700).
// numero/icon são opcionais — o detalhe do pedido ainda os usa até ser
// redesenhado (etapa 4b); o formulário novo não mostra nenhum dos dois.
export function BlocoFormulario({
  numero,
  titulo,
  descricao,
  icon: Icon,
  children,
}: {
  numero?: number;
  titulo: string;
  descricao?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[18px] rounded-xl border border-gray5 bg-surface p-6 shadow-card">
      <div className="flex items-start gap-3">
        {numero !== undefined && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lightPurple4 text-sm font-bold text-purple-text">
            {numero}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-4 text-purple-text" strokeWidth={2} />}
            <h2 className="text-lg font-bold text-darkPurple1">{titulo}</h2>
          </div>
          {descricao && <p className="text-sm text-gray">{descricao}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

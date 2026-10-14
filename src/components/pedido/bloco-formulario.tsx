import type { ReactNode } from "react";

// Seção de formulário do handoff (card branco, padding 24, título 18/700).
export function BlocoFormulario({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-xl border border-gray5 bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-bold text-darkPurple1">{titulo}</h2>
        {descricao && <p className="text-sm text-gray">{descricao}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

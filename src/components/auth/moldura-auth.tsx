import type { ReactNode } from "react";

// Moldura das telas de acesso (login, esqueci a senha, redefinir senha):
// faixa preta com o logo Footure — a mesma identidade do e-mail transacional.
export function MolduraAuth({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-gray5 bg-surface shadow-card">
        <div className="bg-appbar px-8 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
          <img src="/brand/logo-footure-branco.svg" alt="Footure Football Company" className="h-8 w-auto" />
        </div>
        <div className="flex flex-col gap-5 p-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] leading-tight font-bold text-darkPurple1">{titulo}</h1>
            {descricao && <p className="text-sm text-gray">{descricao}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AvisoAuth({ tipo, children }: { tipo: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const cores = {
    erro: "border-red/30 bg-dangerBg text-red",
    sucesso: "border-green1/30 bg-green5 text-green1",
    info: "border-orange/40 bg-orange3 text-[#ce9232]",
  } as const;
  return <p className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${cores[tipo]}`}>{children}</p>;
}

"use client";

import { useEffect, useState } from "react";

const MENSAGENS = {
  enviando: ["Enviando o documento…", "Guardando a nova versão com segurança…"],
  analisando: [
    "Lendo o contrato cláusula por cláusula…",
    "Comparando com o modelo atual…",
    "Identificando as mudanças no texto…",
    "Resumindo cada alteração…",
    "Separando melhorias do modelo e ajustes do cliente…",
    "Quase lá — organizando o resultado…",
  ],
} as const;

/** Uma "folha" de contrato com linhas de texto; `nova` recebe a varredura e os destaques. */
function Folha({ x, nova }: { x: number; nova?: boolean }) {
  const linhas = [14, 24, 34, 44, 54, 64, 74, 84];
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="0" width="72" height="96" rx="8" className="fill-[var(--white)] stroke-[var(--gray5)]" strokeWidth="1.5" />
      {linhas.map((y, i) => (
        <rect key={y} x="10" y={y} width={i % 3 === 2 ? 34 : 52} height="4" rx="2" className="fill-[var(--gray5)]" />
      ))}
      {nova && (
        <>
          {/* Trechos alterados piscando */}
          <rect x="8" y="32" width="56" height="8" rx="3" className="analise-destaque fill-[var(--orange)]" style={{ animationDelay: "0.4s" }} />
          <rect x="8" y="62" width="40" height="8" rx="3" className="analise-destaque fill-[var(--green2)]" style={{ animationDelay: "1.2s" }} />
          {/* Linha de leitura descendo */}
          <rect x="4" y="5" width="64" height="2.5" rx="1.25" className="analise-varredura fill-[var(--darkPurple1)]" />
        </>
      )}
    </g>
  );
}

// Loader da nova versão do contrato: ilustração animada (versão anterior ×
// nova, com varredura e trechos destacados) e mensagens que se alternam.
export function AnaliseEmAndamento({ etapa }: { etapa: "enviando" | "analisando" }) {
  const lista = MENSAGENS[etapa];
  const [indice, setIndice] = useState(0);

  // Mensagens recomeçam do início a cada etapa: o pai monta este componente com key={etapa}.
  useEffect(() => {
    const t = setInterval(() => setIndice((i) => (i + 1) % lista.length), 2800);
    return () => clearInterval(t);
  }, [lista]);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 py-4 text-center">
      <svg viewBox="0 0 200 110" className="analise-flutuar h-[120px] w-auto" aria-hidden>
        <Folha x={14} />
        {/* Seta entre as versões */}
        <path d="M92 48h14m0 0-5-5m5 5-5 5" className="stroke-[var(--gray3)]" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Folha x={114} nova />
        {/* Brilho (IA) */}
        <path
          d="M186 6l2.2 5.8L194 14l-5.8 2.2L186 22l-2.2-5.8L178 14l5.8-2.2z"
          className="analise-brilho fill-[var(--footlink)]"
        />
      </svg>

      <div className="flex min-h-[44px] flex-col gap-1">
        <p key={`${etapa}-${indice}`} className="analise-mensagem text-base font-bold text-darkPurple1">
          {lista[indice]}
        </p>
        <p className="text-xs text-gray3">
          {etapa === "analisando" ? "A análise costuma levar menos de um minuto. Não feche esta janela." : "Isso leva só alguns segundos."}
        </p>
      </div>

      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-gray5">
        <div className="analise-progresso h-full w-1/3 rounded-full bg-darkPurple1" />
      </div>
    </div>
  );
}

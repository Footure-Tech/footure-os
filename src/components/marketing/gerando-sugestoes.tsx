"use client";

import { useEffect, useState } from "react";

const MENSAGENS = [
  "Lendo os números da campanha…",
  "Olhando cada criativo…",
  "Comparando as peças que convertem com as que não convertem…",
  "Pensando em conceitos de criativo novo…",
  "Montando hipóteses de teste…",
  "Quase lá — organizando as sugestões…",
];

// Animação enquanto a IA gera as sugestões (30 s a 1 min): cartões de criativo
// com varredura e mensagens que se alternam — mesmo espírito do loader da
// análise de contratos.
export function GerandoSugestoes() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setI((n) => Math.min(n + 1, MENSAGENS.length - 1)),
      6000,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="flex flex-col items-center gap-5 py-10"
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 240 110" className="h-[110px] w-[240px]" aria-hidden>
        {[0, 84, 168].map((x, n) => (
          <g key={x} transform={`translate(${x} 7)`}>
            <rect
              width="72"
              height="96"
              rx="8"
              className="fill-[var(--white)] stroke-[var(--gray5)]"
              strokeWidth="1.5"
            />
            <rect
              x="8"
              y="8"
              width="56"
              height="48"
              rx="5"
              className="fill-[var(--gray5)]"
            />
            <rect
              x="8"
              y="64"
              width="44"
              height="5"
              rx="2.5"
              className="fill-[var(--gray5)]"
            />
            <rect
              x="8"
              y="75"
              width="30"
              height="5"
              rx="2.5"
              className="fill-[var(--gray5)]"
            />
            <rect
              x="4"
              y="5"
              width="64"
              height="2.5"
              rx="1.25"
              className="analise-varredura fill-[var(--darkPurple1)]"
              style={{ animationDelay: `${n * 0.5}s` }}
            />
          </g>
        ))}
      </svg>
      <p className="text-sm font-semibold text-darkPurple1">{MENSAGENS[i]}</p>
      <p className="text-xs text-gray3">
        Leva de 30 segundos a 1 minuto. Não feche esta janela.
      </p>
    </div>
  );
}

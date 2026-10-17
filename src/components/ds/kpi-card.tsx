import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatarMoedaCompacta } from "@/lib/formatacao";

export type TomDelta = "positivo" | "negativo" | "marca" | "neutro";

const COR_DELTA: Record<TomDelta, string> = {
  positivo: "text-green1",
  negativo: "text-red",
  marca: "text-purple-text",
  neutro: "text-gray2",
};

// KPI card do handoff: rótulo micro, valor 30px/800 e linha de apoio 13px
// (destaque colorido + texto cinza). Use dentro de <GradeKpis>.
export function KpiCard({
  rotulo,
  valor,
  destaque,
  tomDestaque = "marca",
  apoio,
  corValor,
  rodape,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  destaque?: ReactNode;
  tomDestaque?: TomDelta;
  apoio?: ReactNode;
  /** Ex.: "text-red" para "Vencido", "text-green1" para "Recebido". */
  corValor?: string;
  /** Linha secundária abaixo, separada por um divisor (ex.: o realizado sob o previsto). */
  rodape?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-gray5 bg-surface px-6 py-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover",
        className,
      )}
    >
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{rotulo}</span>
      <span className={cn("text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em] text-darkPurple1", corValor)}>{valor}</span>
      {(destaque || apoio) && (
        <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
          {destaque && <span className={cn("font-bold", COR_DELTA[tomDestaque])}>{destaque}</span>}
          {apoio && <span className="text-gray3">{apoio}</span>}
        </div>
      )}
      {rodape && <div className="mt-1 border-t border-gray5 pt-2 text-[13px] text-gray2">{rodape}</div>}
    </div>
  );
}

export function GradeKpis({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5", className)}>{children}</div>;
}

/** Rodapé de KPI dividido por perfil do cliente (clubes × agentes; contato sem
 * cadastro só aparece se houver). `formatar` padrão = moeda compacta. */
export function DivisaoPerfil({
  valores,
  formatar = formatarMoedaCompacta,
}: {
  valores: { clube: number; agente: number; semPerfil: number };
  formatar?: (valor: number) => string;
}) {
  const partes = [
    { rotulo: "Clubes", valor: valores.clube },
    { rotulo: "Agentes", valor: valores.agente },
    ...(valores.semPerfil > 0 ? [{ rotulo: "Sem cadastro", valor: valores.semPerfil }] : []),
  ];
  return <DivisaoValores partes={partes} formatar={formatar} />;
}

/** Rodapé de KPI com a divisão do valor em partes rotuladas (uma por linha). */
export function DivisaoValores({
  partes,
  formatar = formatarMoedaCompacta,
}: {
  partes: { rotulo: string; valor: number }[];
  formatar?: (valor: number) => string;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      {partes.map((p) => (
        <span key={p.rotulo} className="flex items-baseline justify-between gap-3">
          {p.rotulo} <strong className="font-bold text-darkPurple1">{formatar(p.valor)}</strong>
        </span>
      ))}
    </span>
  );
}

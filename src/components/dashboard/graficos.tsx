import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/** Topo "redondo" do eixo Y (1, 2, 2,5 ou 5 × 10^n) acima do maior valor. */
export function topoDoEixo(maximo: number) {
  if (maximo <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(maximo));
  return [1, 2, 2.5, 5, 10].map((m) => m * ordem).find((v) => v >= maximo) ?? maximo;
}

// Tooltip por marca (hover/foco): CSS puro, sem JS.
export function Dica({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md bg-[#09001a] px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-toast group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  );
}

export interface MesReceita {
  chave: string;
  rotulo: string;
  rotuloCompleto: string;
  previsto: number;
  realizado: number;
  futuro: boolean;
}

/**
 * Receita mensal (handoff, layout Visão geral): barras agrupadas realizado ×
 * previsto, 12 meses, eixo Y à esquerda. Cores validadas no validador de
 * paleta (tokens --chart-1/--chart-2 por tema); legenda + tooltip + tabela
 * cobrem o contraste baixo do previsto no tema escuro.
 */
export function GraficoReceitaMensal({ meses }: { meses: MesReceita[] }) {
  const topo = topoDoEixo(Math.max(...meses.flatMap((m) => [m.previsto, m.realizado])));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => topo * f);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[220px] gap-3">
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-gray3" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {formatarMoedaCompacta(t)}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Grade recessiva */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="border-t border-dashed border-gray5 last:border-solid" />
            ))}
          </div>
          <div className="relative flex flex-1 items-end gap-1">
            {meses.map((m) => (
              <div key={m.chave} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] outline-none">
                <span className="w-full max-w-4 rounded-t bg-chart-1" style={{ height: `${(m.realizado / topo) * 100}%` }} />
                <span className="w-full max-w-4 rounded-t bg-chart-2" style={{ height: `${(m.previsto / topo) * 100}%` }} />
                <Dica>
                  <strong className="block font-bold">{m.rotuloCompleto}</strong>
                  Realizado {m.futuro ? "—" : formatarMoeda(m.realizado)}
                  <br />
                  Previsto {formatarMoeda(m.previsto)}
                </Dica>
              </div>
            ))}
          </div>
          <div className="flex h-6 items-end gap-1" aria-hidden>
            {meses.map((m) => (
              <span key={m.chave} className={cn("flex-1 text-center text-[11px]", m.futuro ? "text-gray3 italic" : "text-gray3")}>
                {m.rotulo}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-purple-text">Ver valores em tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-gray3">
              <th className="py-1 font-semibold">Mês</th>
              <th className="py-1 text-right font-semibold">Realizado</th>
              <th className="py-1 text-right font-semibold">Previsto</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.chave} className="border-t border-gray5 text-gray2">
                <td className="py-1">{m.rotuloCompleto}</td>
                <td className="py-1 text-right">{m.futuro ? "—" : formatarMoeda(m.realizado)}</td>
                <td className="py-1 text-right">{formatarMoeda(m.previsto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function LegendaSeries({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray2">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", i.cor)} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Barras verticais por faixa de atraso (handoff: Inadimplência por atraso). */
export function GraficoFaixasAtraso({ faixas }: { faixas: { rotulo: string; cor: string; valor: number; clientes: number }[] }) {
  const maior = Math.max(...faixas.map((f) => f.valor), 1);
  return (
    <div className="flex h-[180px] items-end gap-3">
      {faixas.map((f) => (
        <div key={f.rotulo} tabIndex={0} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5 outline-none">
          <span className="text-xs font-bold text-darkPurple1">{formatarMoedaCompacta(f.valor)}</span>
          <span className={cn("w-full max-w-12 rounded-t", f.cor)} style={{ height: `${Math.max((f.valor / maior) * 70, f.valor > 0 ? 3 : 0)}%` }} />
          <span className="text-[11px] whitespace-nowrap text-gray3">{f.rotulo}</span>
          <Dica>
            {f.rotulo}: {formatarMoeda(f.valor)} · {f.clientes} {f.clientes === 1 ? "cliente" : "clientes"}
          </Dica>
        </div>
      ))}
    </div>
  );
}

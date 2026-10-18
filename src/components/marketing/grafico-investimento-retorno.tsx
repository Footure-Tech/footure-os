import type { PontoRetorno } from "@/lib/marketing/consultas";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import {
  Dica,
  LegendaSeries,
  topoDoEixo,
} from "@/components/dashboard/graficos";
import { cn } from "@/lib/utils";

/**
 * Investimento (Meta) × Receita atribuída (Kommo, na data do lead), barras
 * agrupadas por mês ou semana — mesmo padrão de GraficoReceitaMensal. Safra
 * imatura: barra de receita com contorno tracejado (a verba de hoje gera
 * receita que ainda não fechou).
 */
export function GraficoInvestimentoRetorno({
  pontos,
}: {
  pontos: PontoRetorno[];
}) {
  const topo = topoDoEixo(
    Math.max(...pontos.flatMap((p) => [p.investimento, p.receita]), 0),
  );
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => topo * f);
  const passo = Math.max(1, Math.ceil(pontos.length / 14));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LegendaSeries
          itens={[
            { rotulo: "Investimento", cor: "bg-chart-1" },
            { rotulo: "Receita atribuída", cor: "bg-chart-2" },
          ]}
        />
        <span className="flex items-center gap-1.5 text-xs text-gray2">
          <span className="size-2.5 rounded-sm border border-dashed border-gray2" />
          Safra imatura
        </span>
      </div>
      <div className="flex h-[240px] gap-3">
        <div
          className="flex flex-col justify-between pb-6 text-right text-[11px] text-gray3"
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {formatarMoedaCompacta(t)}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between"
            aria-hidden
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="border-t border-dashed border-gray5 last:border-solid"
              />
            ))}
          </div>
          <div className="relative flex flex-1 items-end gap-1">
            {pontos.map((p) => (
              <div
                key={p.chave}
                tabIndex={0}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] outline-none"
              >
                <span
                  className="w-full max-w-5 rounded-t-[4px] bg-chart-1"
                  style={{ height: `${(p.investimento / topo) * 100}%` }}
                />
                <span
                  className={cn(
                    "w-full max-w-5 rounded-t-[4px]",
                    p.imatura
                      ? "border-2 border-b-0 border-dashed border-gray2 bg-chart-2/50"
                      : "bg-chart-2",
                  )}
                  style={{
                    height: `${(p.receita / topo) * 100}%`,
                    minHeight: p.imatura ? 4 : undefined,
                  }}
                />
                <Dica>
                  <strong className="block font-bold">
                    {p.rotuloCompleto}
                  </strong>
                  Investimento {formatarMoeda(p.investimento)}
                  <br />
                  Receita atribuída {formatarMoeda(p.receita)} · {p.vendas}{" "}
                  {p.vendas === 1 ? "venda" : "vendas"}
                  {p.investimento > 0 && (
                    <>
                      <br />
                      ROAS parcial{" "}
                      {(p.receita / p.investimento)
                        .toFixed(2)
                        .replace(".", ",")}
                    </>
                  )}
                  {p.imatura && (
                    <>
                      <br />
                      <em>
                        Safra imatura: leads recentes ainda podem virar venda.
                      </em>
                    </>
                  )}
                </Dica>
              </div>
            ))}
          </div>
          <div className="flex h-6 items-end gap-1" aria-hidden>
            {pontos.map((p, i) => (
              <span
                key={p.chave}
                className="relative min-w-0 flex-1 text-center text-[11px] text-gray3"
              >
                {i % passo === 0 && (
                  <span
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
                      p.imatura && "italic",
                    )}
                  >
                    {p.rotulo}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-purple-text">
          Ver valores em tabela
        </summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-gray3">
              <th className="py-1 font-semibold">Período</th>
              <th className="py-1 text-right font-semibold">Investimento</th>
              <th className="py-1 text-right font-semibold">
                Receita atribuída
              </th>
              <th className="py-1 text-right font-semibold">Vendas</th>
              <th className="py-1 text-right font-semibold">ROAS parcial</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.chave} className="border-t border-gray5 text-gray2">
                <td className="py-1">
                  {p.rotuloCompleto}
                  {p.imatura && " (imatura)"}
                </td>
                <td className="py-1 text-right">
                  {formatarMoeda(p.investimento)}
                </td>
                <td className="py-1 text-right">{formatarMoeda(p.receita)}</td>
                <td className="py-1 text-right">{p.vendas}</td>
                <td className="py-1 text-right">
                  {p.investimento
                    ? (p.receita / p.investimento).toFixed(2).replace(".", ",")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

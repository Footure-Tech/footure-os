"use client";

import { useState } from "react";
import { agruparSemanal, dataCurta, type PontoSerie } from "@/lib/academy/series";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Dica, topoDoEixo } from "@/components/dashboard/graficos";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { cn } from "@/lib/utils";

type Granularidade = "diaria" | "semanal";
type Metrica = "valor" | "quantidade";

/** Até ~9 rótulos no eixo X, espaçados por igual. */
const passoRotulos = (n: number) => Math.max(1, Math.ceil(n / 9));

// Evolução das vendas (padrão dos gráficos do Dashboard: barras em HTML,
// grade recessiva, dica por barra). Linha tracejada = média por período;
// barra de pico em destaque.
export function GraficoEvolucao({ diaria }: { diaria: PontoSerie[] }) {
  const [granularidade, setGranularidade] = useState<Granularidade>(diaria.length > 62 ? "semanal" : "diaria");
  const [metrica, setMetrica] = useState<Metrica>("valor");
  const serie = granularidade === "semanal" ? agruparSemanal(diaria) : diaria;
  const valor = (p: PontoSerie) => (metrica === "valor" ? p.valor : p.quantidade);
  const formatar = (v: number) => (metrica === "valor" ? formatarMoedaCompacta(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
  const maximo = Math.max(...serie.map(valor), 0);
  const topo = topoDoEixo(maximo);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => topo * f);
  const media = serie.length ? serie.reduce((s, p) => s + valor(p), 0) / serie.length : 0;
  const pico = serie.findIndex((p) => valor(p) === maximo && maximo > 0);
  const passo = passoRotulos(serie.length);
  const rotulo = (p: PontoSerie) => (granularidade === "semanal" ? `Semana de ${dataCurta(p.chave)}` : dataCurta(p.chave));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedToggle
          valor={metrica}
          onChange={setMetrica}
          opcoes={[
            { valor: "valor", rotulo: "Faturamento (R$)" },
            { valor: "quantidade", rotulo: "Quantidade" },
          ]}
        />
        <SegmentedToggle
          valor={granularidade}
          onChange={setGranularidade}
          opcoes={[
            { valor: "diaria", rotulo: "Diária" },
            { valor: "semanal", rotulo: "Semanal" },
          ]}
        />
      </div>

      <div className="flex h-[240px] gap-3">
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-gray3" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {formatar(t)}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="border-t border-dashed border-gray5 last:border-solid" />
            ))}
          </div>
          <div className="relative flex flex-1 items-end">
            {media > 0 && (
              <div className="pointer-events-none absolute inset-x-0 z-[1] border-t-2 border-dashed border-gray2" style={{ bottom: `${(media / topo) * 100}%` }} aria-hidden>
                <span className="absolute right-0 bottom-1 rounded bg-surface px-1.5 text-[11px] font-semibold text-gray2">média {formatar(media)}</span>
              </div>
            )}
            {serie.map((p, i) => (
              <div key={p.chave} tabIndex={0} className={cn("group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none", serie.length > 60 ? "px-px" : "px-[2px]")}>
                <span
                  className={cn("w-full max-w-6 rounded-t-[4px]", i === pico ? "bg-chart-1" : "bg-chart-2 group-hover:bg-gray3")}
                  style={{ height: `${(valor(p) / topo) * 100}%`, minHeight: valor(p) > 0 ? 2 : 0 }}
                />
                <Dica>
                  <strong className="block font-bold">
                    {rotulo(p)}
                    {i === pico ? " · pico" : ""}
                  </strong>
                  {formatarMoeda(p.valor)} · {p.quantidade} {p.quantidade === 1 ? "venda" : "vendas"}
                </Dica>
              </div>
            ))}
          </div>
          <div className="flex h-6 items-end" aria-hidden>
            {serie.map((p, i) => (
              <span key={p.chave} className="relative min-w-0 flex-1 text-center text-[11px] text-gray3">
                {i % passo === 0 && (
                  // Telas estreitas: metade dos rótulos.
                  <span className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap", (i / passo) % 2 === 1 && "max-sm:hidden")}>
                    {dataCurta(p.chave).slice(0, 5)}
                  </span>
                )}
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
              <th className="py-1 font-semibold">{granularidade === "semanal" ? "Semana" : "Dia"}</th>
              <th className="py-1 text-right font-semibold">Vendas</th>
              <th className="py-1 text-right font-semibold">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {serie
              .filter((p) => p.quantidade > 0)
              .map((p) => (
                <tr key={p.chave} className="border-t border-gray5 text-gray2">
                  <td className="py-1">{rotulo(p)}</td>
                  <td className="py-1 text-right">{p.quantidade}</td>
                  <td className="py-1 text-right">{formatarMoeda(p.valor)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

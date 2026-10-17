import type { PontoSerie } from "@/lib/academy/series";
import { dataCurta } from "@/lib/academy/series";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { Dica, topoDoEixo } from "@/components/dashboard/graficos";

// Faturamento acumulado no recorte: área + linha em SVG (escala livre, traço
// sem distorção), com dica por dia sobre colunas invisíveis.
export function GraficoAcumulado({ diaria }: { diaria: PontoSerie[] }) {
  const pontos = diaria.reduce<{ chave: string; valor: number }[]>((acc, d) => [...acc, { chave: d.chave, valor: (acc.at(-1)?.valor ?? 0) + d.valor }], []);
  const soma = pontos.at(-1)?.valor ?? 0;
  const topo = topoDoEixo(soma);
  const ticks = [1, 0.5, 0].map((f) => topo * f);
  const x = (i: number) => (pontos.length > 1 ? (i / (pontos.length - 1)) * 1000 : 500);
  const y = (v: number) => 200 - (v / topo) * 200;
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},200 L${x(0)},200 Z`;

  return (
    <div className="flex h-[200px] gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-gray3" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
            {formatarMoedaCompacta(t)}
          </span>
        ))}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="border-t border-dashed border-gray5 last:border-solid" />
          ))}
        </div>
        <div className="relative flex-1">
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <path d={area} className="fill-chart-2/40" />
            <path d={linha} className="fill-none stroke-chart-1" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <div className="absolute inset-0 flex">
            {pontos.map((p) => (
              <div key={p.chave} tabIndex={0} className="group relative h-full min-w-0 flex-1 outline-none">
                <Dica>
                  <strong className="block font-bold">{dataCurta(p.chave)}</strong>
                  Acumulado {formatarMoeda(p.valor)}
                </Dica>
              </div>
            ))}
          </div>
        </div>
        <div className="flex h-6 items-end justify-between text-[11px] text-gray3" aria-hidden>
          <span>{pontos[0] && dataCurta(pontos[0].chave)}</span>
          <span className="font-semibold text-darkPurple1">{formatarMoeda(soma)}</span>
          <span>{pontos.at(-1) && dataCurta(pontos.at(-1)!.chave)}</span>
        </div>
      </div>
    </div>
  );
}

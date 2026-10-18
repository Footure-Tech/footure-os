"use client";

import { useState } from "react";
import { MdCampaign, MdImageNotSupported } from "react-icons/md";
import type { LinhaCriativo, SerieAnuncio } from "@/lib/marketing/consultas";
import { formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import {
  Dica,
  LegendaSeries,
  topoDoEixo,
} from "@/components/dashboard/graficos";
import { StatusPill } from "@/components/ds/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { situacaoAnuncio } from "@/components/marketing/situacao-anuncio";

type Criativo = Pick<
  LinhaCriativo,
  | "adId"
  | "nome"
  | "imagemUrl"
  | "statusAnuncio"
  | "gasto"
  | "leads"
  | "leadsMeta"
>;

const TODOS = "todos";
const JANELA = 7;
const VOLUME_MINIMO = 10;

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");
const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);
const acumular = (v: number[]) =>
  v.reduce<number[]>((acc, x) => [...acc, (acc.at(-1) ?? 0) + x], []);

/**
 * Ritmo dos últimos 7 dias contra os 7 anteriores: tração (leads por dia
 * subindo sem o custo subir) ou sinais de saturação (CPL subindo, ou leads
 * caindo sem o gasto cair). Leads da Meta como base; sem eles, os do CRM.
 * Abaixo de VOLUME_MINIMO leads nas duas semanas, não classifica.
 */
function ritmo(leads: number[], gasto: number[]) {
  const n = leads.length;
  if (n < JANELA * 2) return null;
  const recente = {
    leads: soma(leads.slice(n - JANELA)),
    gasto: soma(gasto.slice(n - JANELA)),
  };
  const anterior = {
    leads: soma(leads.slice(n - JANELA * 2, n - JANELA)),
    gasto: soma(gasto.slice(n - JANELA * 2, n - JANELA)),
  };
  const cpl = (p: { leads: number; gasto: number }) =>
    p.leads ? p.gasto / p.leads : null;
  const variacao = (a: number, b: number) => (b ? (a - b) / b : null);
  const vLeads = variacao(recente.leads, anterior.leads);
  const cplRec = cpl(recente);
  const cplAnt = cpl(anterior);
  const vCpl =
    cplRec !== null && cplAnt !== null ? variacao(cplRec, cplAnt) : null;
  const vGasto = variacao(recente.gasto, anterior.gasto);

  let situacao: { rotulo: string; tom: "active" | "pending" | "not_started" };
  if (recente.gasto === 0)
    situacao = { rotulo: "Sem veiculação", tom: "not_started" };
  // Poucos leads nas duas semanas: a variação é ruído, não sinal.
  else if (recente.leads + anterior.leads < VOLUME_MINIMO)
    situacao = { rotulo: "Pouco volume", tom: "not_started" };
  else if (
    (vCpl !== null && vCpl >= 0.25) ||
    (vLeads !== null && vLeads <= -0.25 && (vGasto ?? 0) > -0.25)
  )
    situacao = { rotulo: "Sinais de saturação", tom: "pending" };
  else if (vLeads !== null && vLeads >= 0.15 && (vCpl === null || vCpl < 0.15))
    situacao = { rotulo: "Tracionando", tom: "active" };
  else situacao = { rotulo: "Estável", tom: "not_started" };
  return { recente, anterior, cplRec, cplAnt, situacao };
}

function Miniatura({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  if (!url)
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border border-dashed border-gray5 text-gray3",
          className,
        )}
      >
        <MdImageNotSupported className="size-4" />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage
    <img
      src={url}
      alt=""
      className={cn(
        "shrink-0 rounded-md border border-gray5 object-cover",
        className,
      )}
    />
  );
}

/** Opção do seletor: miniatura, nome, situação na Meta e os números do criativo. */
function OpcaoCriativo({ c }: { c: Criativo }) {
  const s = situacaoAnuncio(c.statusAnuncio);
  const Icone = s?.icone;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Miniatura
        url={c.imagemUrl}
        className={cn("size-10", s?.parado && "opacity-60 grayscale")}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold text-darkPurple1">
          {c.nome}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray3">
          {s && Icone && (
            <span className="flex items-center gap-0.5" title={s.rotulo}>
              <Icone className="size-3.5" aria-hidden />
              {s.rotulo}
            </span>
          )}
          {s && "·"}
          <span>
            {formatarMoeda(c.gasto)} · {inteiro(c.leadsMeta)} leads Meta ·{" "}
            {c.leads} CRM
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Leads acumulados no período (Meta e CRM), da campanha inteira ou de um
 * criativo: a curva que empina mostra tração; a que achata com gasto mostra
 * saturação. Mesmo padrão do GraficoAcumulado (área + linha em SVG).
 */
export function GraficoLeadsAcumulados({
  dias,
  series,
  serieCampanha,
  inicioJanelaAnuncio,
  criativos,
}: {
  dias: string[];
  series: Record<string, SerieAnuncio>;
  /** Nível campanha (a mesma base dos KPIs). */
  serieCampanha: SerieAnuncio;
  inicioJanelaAnuncio: string;
  criativos: Criativo[];
}) {
  const [selecionado, setSelecionado] = useState(TODOS);
  // Ativos primeiro; dentro de cada grupo, do maior gasto para o menor.
  const ordenados = [...criativos].sort(
    (a, b) =>
      Number(b.statusAnuncio === "ACTIVE") -
        Number(a.statusAnuncio === "ACTIVE") || b.gasto - a.gasto,
  );
  const escolhida = selecionado === TODOS ? serieCampanha : series[selecionado];
  const vazio = dias.map(() => 0);
  const diaMeta = escolhida?.meta ?? vazio;
  const diaCrm = escolhida?.crm ?? vazio;
  const diaGasto = escolhida?.gasto ?? vazio;
  const meta = acumular(diaMeta);
  const crm = acumular(diaCrm);
  // Criativo num período que começa antes do primeiro dado por anúncio.
  const antesDaJanela =
    selecionado !== TODOS && !!dias[0] && dias[0] < inicioJanelaAnuncio;
  const usaMeta = soma(diaMeta) > 0;
  const r = ritmo(usaMeta ? diaMeta : diaCrm, diaGasto);

  const topo = topoDoEixo(Math.max(meta.at(-1) ?? 0, crm.at(-1) ?? 0));
  const ticks = [1, 0.5, 0].map((f) => topo * f);
  const x = (i: number) =>
    dias.length > 1 ? (i / (dias.length - 1)) * 1000 : 500;
  const y = (v: number) => 200 - (v / topo) * 200;
  const caminho = (v: number[]) =>
    v.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p)}`).join(" ");
  const area = `${caminho(meta)} L${x(dias.length - 1)},200 L${x(0)},200 Z`;
  const meio = Math.floor((dias.length - 1) / 2);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={selecionado}
          onValueChange={(v) => v && setSelecionado(v)}
        >
          <SelectTrigger
            aria-label="Filtrar por criativo"
            className="h-auto min-h-12 w-[min(440px,100%)] py-1.5"
          >
            <SelectValue>
              {(v: string) => {
                const c = criativos.find((x) => x.adId === v);
                return c ? (
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Miniatura url={c.imagemUrl} className="size-8" />
                    <span className="truncate font-semibold text-darkPurple1">
                      {c.nome}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-md bg-light text-gray2">
                      <MdCampaign className="size-4" />
                    </span>
                    <span className="font-semibold text-darkPurple1">
                      Todos os criativos
                    </span>
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="max-h-[420px] w-[min(520px,92vw)]"
          >
            <SelectItem value={TODOS} className="py-2">
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-light text-gray2">
                  <MdCampaign className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-darkPurple1">
                    Todos os criativos
                  </span>
                  <span className="text-[11px] text-gray3">
                    {criativos.length}{" "}
                    {criativos.length === 1 ? "criativo" : "criativos"} ·{" "}
                    {formatarMoeda(soma(serieCampanha.gasto))}
                  </span>
                </span>
              </span>
            </SelectItem>
            {ordenados.map((c) => (
              <SelectItem key={c.adId} value={c.adId} className="py-2">
                <OpcaoCriativo c={c} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <LegendaSeries
          itens={[
            { rotulo: "Leads Meta", cor: "bg-chart-5" },
            { rotulo: "Leads CRM (Kommo)", cor: "bg-chart-1" },
          ]}
        />
      </div>

      <div className="flex h-[220px] gap-3">
        <div
          className="flex flex-col justify-between pb-6 text-right text-[11px] text-gray3"
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {inteiro(t)}
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
          <div className="relative flex-1">
            <svg
              viewBox="0 0 1000 200"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              <path d={area} className="fill-chart-2/30" />
              <path
                d={caminho(meta)}
                className="fill-none stroke-chart-5"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <path
                d={caminho(crm)}
                className="fill-none stroke-chart-1"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute inset-0 flex">
              {dias.map((d, i) => (
                <div
                  key={d}
                  tabIndex={0}
                  className="group relative h-full min-w-0 flex-1 outline-none hover:bg-gray5/40 focus-visible:bg-gray5/40"
                >
                  <Dica>
                    <strong className="block font-bold">{dataCurta(d)}</strong>
                    Leads Meta {inteiro(meta[i])} (+{inteiro(diaMeta[i])} no
                    dia)
                    <br />
                    Leads CRM {inteiro(crm[i])} (+{diaCrm[i]} no dia)
                    <br />
                    Gasto no dia {formatarMoeda(diaGasto[i])}
                  </Dica>
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex h-6 items-end justify-between text-[11px] text-gray3"
            aria-hidden
          >
            <span>{dias[0] && dataCurta(dias[0])}</span>
            <span>{dias[meio] && dataCurta(dias[meio])}</span>
            <span>{dias.at(-1) && dataCurta(dias.at(-1)!)}</span>
          </div>
        </div>
      </div>

      {antesDaJanela && (
        <p className="text-xs text-gray3">
          Dados por criativo só desde {dataCurta(inicioJanelaAnuncio)}; antes
          disso, só o total da campanha.
        </p>
      )}

      {r && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray5 pt-3 text-[13px] text-gray2">
          <StatusPill tom={r.situacao.tom}>{r.situacao.rotulo}</StatusPill>
          {r.recente.gasto === 0 ? (
            <span>
              Sem gasto nos últimos {JANELA} dias
              {selecionado === TODOS ? "" : " — anúncio parado"}.
            </span>
          ) : (
            <>
              <span>
                Últimos {JANELA} dias:{" "}
                <strong className="font-semibold text-darkPurple1">
                  {inteiro(r.recente.leads)} leads {usaMeta ? "Meta" : "CRM"}
                </strong>{" "}
                (contra {inteiro(r.anterior.leads)} nos {JANELA} anteriores)
              </span>
              <span>
                CPL{" "}
                <strong className="font-semibold text-darkPurple1">
                  {r.cplAnt === null ? "—" : formatarMoeda(r.cplAnt)} →{" "}
                  {r.cplRec === null ? "—" : formatarMoeda(r.cplRec)}
                </strong>
              </span>
              <span>
                Gasto {formatarMoeda(r.anterior.gasto)} →{" "}
                {formatarMoeda(r.recente.gasto)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

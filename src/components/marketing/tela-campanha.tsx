import { MdCampaign, MdInfoOutline, MdLightbulbOutline } from "react-icons/md";
import {
  ROTULO_BU,
  type carregarCriativos,
  type PeriodoMarketing,
} from "@/lib/marketing/consultas";
import type { Acao } from "@/lib/marketing/motor";
import { formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { PageHeader } from "@/components/shell/page-header";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo } from "@/components/negocio/card-modulo";
import { TOM_BU } from "@/components/marketing/links";
import { ImagemCriativo } from "@/components/marketing/imagem-criativo";
import { SugestoesIa } from "@/components/marketing/sugestoes-ia";
import type { carregarSugestoesIa } from "@/lib/marketing/sugestoesIa";

type Dados = NonNullable<Awaited<ReturnType<typeof carregarCriativos>>>;
type Criativo = Dados["criativos"][number];

const TOM_ACAO: Record<
  Acao,
  "active" | "in_progress" | "pending" | "inactive" | "not_started"
> = {
  ESCALAR: "active",
  MANTER: "in_progress",
  REVISAR: "pending",
  PAUSAR: "inactive",
  OBSERVAR: "not_started",
};
const PERIODOS: { valor: PeriodoMarketing; rotulo: string }[] = [
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
];

const moeda = (v: number | null) => (v === null ? "—" : formatarMoeda(v));
const decimal = (v: number | null, casas = 2) =>
  v === null ? "—" : v.toFixed(casas).replace(".", ",");
const dataCurta = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "—";

// Marketing · detalhe da campanha: recomendações de portfólio e ranking por
// criativo (ação sugerida + por quê), na janela do nível anúncio (90 dias).
export function TelaCampanha({
  dados,
  periodo,
  sugestoes,
}: {
  dados: Dados;
  periodo: PeriodoMarketing;
  sugestoes: Awaited<ReturnType<typeof carregarSugestoesIa>>;
}) {
  const { campanha } = dados;
  const voltar =
    periodo === "90d" ? "/marketing" : `/marketing?periodo=${periodo}`;
  const hrefPeriodo = (p: PeriodoMarketing) =>
    `/marketing/campanhas/${encodeURIComponent(campanha.chave)}${p === "90d" ? "" : `?periodo=${p}`}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Marketing · Campanha"
        titulo={campanha.nome}
        descricao={`Gasto ${formatarMoeda(dados.totais.gasto)} · ${dados.totais.ativos} ${dados.totais.ativos === 1 ? "criativo ativo" : "criativos ativos"} · de ${dataCurta(dados.de)} a ${dataCurta(dados.ate)}`}
        voltarHref={voltar}
        acoes={
          <>
            <BadgeTom tom={TOM_BU[campanha.bu]}>
              {ROTULO_BU[campanha.bu]}
            </BadgeTom>
            <SegmentedToggle
              valor={periodo === "30d" ? "30d" : "90d"}
              opcoes={PERIODOS.map((p) => ({
                ...p,
                href: hrefPeriodo(p.valor),
              }))}
            />
          </>
        }
      />

      <KpisCampanha criativos={dados.criativos} />

      <CardModulo
        icone={MdLightbulbOutline}
        cor="bg-iconYellow"
        titulo="Recomendações da campanha"
        className="min-w-0"
        extra={
          <SugestoesIa
            chave={campanha.chave}
            periodo={periodo === "30d" ? "30d" : "90d"}
            rodadas={sugestoes.rodadas}
            recenteId={sugestoes.recenteId}
            consumo={sugestoes.consumo}
          />
        }
      >
        <ul className="flex flex-col gap-2.5">
          {dados.recomendacoes.map((r) => (
            <li key={r.titulo} className="text-sm text-gray2">
              <strong className="font-bold text-darkPurple1">
                {r.titulo}:
              </strong>{" "}
              {r.texto}
            </li>
          ))}
        </ul>
        <p className="text-xs font-semibold text-gray3">
          Recomendações para validação humana — nada é executado
          automaticamente.
        </p>
      </CardModulo>

      {dados.criativos.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdCampaign}
            titulo="Nenhum criativo com gasto no período"
            descricao="O ranking por criativo cobre só a janela recente do nível anúncio (90 dias)."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {dados.criativos.map((c) => (
            <li key={c.adId}>
              <CartaoCriativo c={c} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 rounded-xl border border-gray5 bg-surface p-4 text-xs text-gray3">
        <MdInfoOutline className="mt-px size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <span>
            Leads do Kommo por criativo: pelo ID do anúncio (forte) ou, sem ele,
            pelo nome do criativo quando corresponde a um único anúncio
            (&ldquo;recuperado por nome&rdquo;). Leads maduros = criados há mais
            que a mediana de {decimal(dados.medianaDias, 1)} dias entre lead e
            venda; criativo com mais da metade dos leads ainda imaturos fica em
            OBSERVAR.
          </span>
          <span>
            Dados por criativo disponíveis desde{" "}
            {dataCurta(dados.inicioJanelaAnuncio)} (janela de 90 dias do nível
            anúncio).
          </span>
        </div>
      </div>
    </div>
  );
}

/** Totais da campanha no período (soma dos criativos; frequência ponderada pelas impressões). */
function KpisCampanha({ criativos }: { criativos: Criativo[] }) {
  const soma = (f: (c: Criativo) => number) =>
    criativos.reduce((s, c) => s + f(c), 0);
  const gasto = soma((c) => c.gasto);
  const impressoes = soma((c) => c.impressoes);
  const freq = impressoes
    ? soma((c) => (c.frequencia ?? 0) * c.impressoes) / impressoes
    : null;
  const leadsMeta = soma((c) => c.leadsMeta);
  const leadsCrm = soma((c) => c.leads);
  const mql = soma((c) => c.mql);
  const vendas = soma((c) => c.vendas);
  const receita = soma((c) => c.receita);
  const ativos = criativos.filter((c) => c.gasto > 0).length;
  const div = (a: number, b: number) => (b ? a / b : null);
  const roas = leadsCrm ? div(receita, gasto) : null;
  return (
    <GradeKpis>
      <KpiCard
        rotulo="Investimento"
        valor={formatarMoedaCompacta(gasto)}
        apoio={`${ativos} ${ativos === 1 ? "criativo ativo" : "criativos ativos"} · freq. média ${decimal(freq)}`}
      />
      <KpiCard
        rotulo="Leads (Meta)"
        valor={Math.round(leadsMeta).toLocaleString("pt-BR")}
        apoio={`CPL Meta ${moeda(div(gasto, leadsMeta))}`}
        rodape={
          <>
            No CRM{" "}
            <strong className="font-bold text-darkPurple1">{leadsCrm}</strong>
            <span className="text-gray3">
              {" "}
              · CPL {moeda(div(gasto, leadsCrm))}
            </span>
          </>
        }
      />
      <KpiCard
        rotulo="Vendas atribuídas"
        valor={String(vendas)}
        apoio={`CAC ${moeda(div(gasto, vendas))}`}
        rodape={
          <>
            MQL <strong className="font-bold text-darkPurple1">{mql}</strong>
            <span className="text-gray3">
              {" "}
              · custo por MQL {moeda(div(gasto, mql))}
            </span>
          </>
        }
      />
      <KpiCard
        rotulo="Receita atribuída"
        valor={receita ? formatarMoedaCompacta(receita) : "—"}
        destaque={roas === null ? undefined : `ROAS ${decimal(roas)}`}
        tomDestaque={
          roas === null ? "marca" : roas >= 1 ? "positivo" : "negativo"
        }
        apoio="vendas do Kommo ligadas aos criativos"
      />
    </GradeKpis>
  );
}

/** Um número do cartão do criativo. */
function Metrica({
  rotulo,
  valor,
  destaque = false,
  className,
}: {
  rotulo: string;
  valor: React.ReactNode;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
        {rotulo}
      </dt>
      <dd
        className={
          destaque
            ? "text-base font-bold text-darkPurple1"
            : "text-sm font-semibold text-darkPurple1"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * Cartão do criativo: miniatura, ação sugerida com o porquê e os números.
 * Números sem dado ainda ficam de fora (receita, ROAS e CAC só com venda;
 * tendência de CPL só com leads nas duas metades do período).
 */
function CartaoCriativo({ c }: { c: Criativo }) {
  return (
    <article className="flex flex-col gap-5 rounded-xl border border-gray5 bg-surface p-5 shadow-card lg:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        <ImagemCriativo url={c.imagemUrl} nome={c.nome} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tom={TOM_ACAO[c.acao]}>{c.acao}</StatusPill>
            {c.saturando && (
              <span title={c.motivoSaturacao}>
                <StatusPill tom="pending">Saturando</StatusPill>
              </span>
            )}
            {c.jovem && <StatusPill tom="not_started">Jovem</StatusPill>}
            {c.recuperados > 0 && (
              <span
                title={`${c.recuperados} ${c.recuperados === 1 ? "lead atribuído" : "leads atribuídos"} pelo nome do criativo (sem ID do anúncio)`}
              >
                <StatusPill tom="not_started">Recuperado por nome</StatusPill>
              </span>
            )}
          </div>
          <h3 className="text-[15px] leading-snug font-bold text-darkPurple1">
            {c.nome}
          </h3>
          {c.conjunto && (
            <span className="text-xs text-gray3">Conjunto: {c.conjunto}</span>
          )}
          <p className="mt-1 text-[13px] leading-relaxed text-gray2">
            <strong className="font-semibold text-darkPurple1">
              Por quê:{" "}
            </strong>
            {c.motivo}
          </p>
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 border-t border-gray5 pt-4 sm:grid-cols-4 lg:w-[440px] lg:grid-cols-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <Metrica rotulo="Gasto" valor={formatarMoeda(c.gasto)} destaque />
        <Metrica
          rotulo="Leads CRM"
          valor={
            <>
              {c.leads}{" "}
              <span className="text-xs font-normal text-gray3">
                ({c.leadsMaduros} maduros)
              </span>
            </>
          }
        />
        <Metrica
          rotulo="Leads Meta"
          valor={Math.round(c.leadsMeta).toLocaleString("pt-BR")}
        />
        <Metrica rotulo="MQL" valor={c.mql} />
        <Metrica rotulo="Vendas" valor={c.vendas} />
        {c.vendas > 0 && (
          <Metrica rotulo="Receita" valor={formatarMoeda(c.receita)} />
        )}
        {c.vendas > 0 && (
          <Metrica rotulo="ROAS" valor={decimal(c.roas)} destaque />
        )}
        {c.vendas > 0 && <Metrica rotulo="CAC" valor={moeda(c.cac)} />}
        <Metrica rotulo="Frequência" valor={decimal(c.frequencia)} />
        {c.cplIni !== null && c.cplFim !== null && (
          <Metrica
            rotulo="CPL 1ª → 2ª metade"
            valor={`${moeda(c.cplIni)} → ${moeda(c.cplFim)}`}
            className="col-span-2"
          />
        )}
      </dl>
    </article>
  );
}

import {
  MdCampaign,
  MdImageNotSupported,
  MdInfoOutline,
  MdLightbulbOutline,
} from "react-icons/md";
import {
  ROTULO_BU,
  type carregarCriativos,
  type PeriodoMarketing,
} from "@/lib/marketing/consultas";
import type { Acao } from "@/lib/marketing/motor";
import { formatarMoeda } from "@/lib/formatacao";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo } from "@/components/negocio/card-modulo";
import { TOM_BU } from "@/components/marketing/tela-desempenho";

type Dados = NonNullable<Awaited<ReturnType<typeof carregarCriativos>>>;

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
}: {
  dados: Dados;
  periodo: PeriodoMarketing;
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

      <CardModulo
        icone={MdLightbulbOutline}
        cor="bg-iconYellow"
        titulo="Recomendações da campanha"
        className="min-w-0"
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
        <Table minWidth={1500}>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Criativo</TableHead>
              <TableHead>Gasto</TableHead>
              <TableHead>Leads (maduros)</TableHead>
              <TableHead>MQL</TableHead>
              <TableHead>Vendas</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead>CAC</TableHead>
              <TableHead>ROAS</TableHead>
              <TableHead>Freq.</TableHead>
              <TableHead>CPL 1ª → 2ª metade</TableHead>
              <TableHead>Por quê</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.criativos.map((c) => (
              <TableRow key={c.adId}>
                <TableCell>
                  <StatusPill tom={TOM_ACAO[c.acao]}>{c.acao}</StatusPill>
                </TableCell>
                <TableCell className="max-w-[380px] whitespace-normal">
                  <div className="flex items-start gap-3">
                    {c.imagemUrl ? (
                      <a
                        href={c.imagemUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir a miniatura do criativo"
                        className="shrink-0 rounded-lg focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage */}
                        <img
                          src={c.imagemUrl}
                          alt={`Criativo ${c.nome}`}
                          width={64}
                          height={64}
                          className="size-16 rounded-lg border border-gray5 object-cover"
                        />
                      </a>
                    ) : (
                      <span
                        className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray5 text-gray3"
                        title="Sem miniatura na Meta"
                      >
                        <MdImageNotSupported className="size-6" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <span className="font-bold text-darkPurple1">
                        {c.nome}
                      </span>
                      {c.conjunto && (
                        <span className="text-xs text-gray3">
                          Conjunto: {c.conjunto}
                        </span>
                      )}
                      <span className="flex flex-wrap gap-1">
                        {c.saturando && (
                          <span title={c.motivoSaturacao}>
                            <StatusPill tom="pending">Saturando</StatusPill>
                          </span>
                        )}
                        {c.recuperados > 0 && (
                          <span
                            title={`${c.recuperados} ${c.recuperados === 1 ? "lead atribuído" : "leads atribuídos"} pelo nome do criativo (sem ID do anúncio)`}
                          >
                            <StatusPill tom="not_started">
                              Recuperado por nome
                            </StatusPill>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-darkPurple1">
                  {formatarMoeda(c.gasto)}
                </TableCell>
                <TableCell className="text-gray2">
                  {c.leads}{" "}
                  <span className="text-xs text-gray3">({c.leadsMaduros})</span>
                  <span className="block text-xs text-gray3">
                    Meta: {Math.round(c.leadsMeta)}
                  </span>
                </TableCell>
                <TableCell className="text-gray2">{c.mql}</TableCell>
                <TableCell className="text-gray2">{c.vendas}</TableCell>
                <TableCell className="font-semibold text-darkPurple1">
                  {c.receita ? formatarMoeda(c.receita) : "—"}
                </TableCell>
                <TableCell className="text-gray2">{moeda(c.cac)}</TableCell>
                <TableCell className="font-bold text-darkPurple1">
                  {decimal(c.roas)}
                </TableCell>
                <TableCell className="text-gray2">
                  {decimal(c.frequencia)}
                </TableCell>
                <TableCell className="text-gray2">
                  {moeda(c.cplIni)} → {moeda(c.cplFim)}
                </TableCell>
                <TableCell className="max-w-[360px] text-[13px] whitespace-normal text-gray2">
                  {c.motivo}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

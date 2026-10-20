import {
  MdAltRoute,
  MdArrowDownward,
  MdArrowUpward,
  MdFilterAlt,
  MdFlag,
  MdGroups,
  MdInfoOutline,
  MdTroubleshoot,
  MdTrendingDown,
  MdWarningAmber,
} from "react-icons/md";
import type { carregarFunil, CartaoDiagnostico, Hipotese, LinhaQualidade, PassoFunil } from "@/lib/marketing/consultasFunil";
import { formatarMoeda } from "@/lib/formatacao";
import { CardModulo } from "@/components/negocio/card-modulo";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Funil = NonNullable<Awaited<ReturnType<typeof carregarFunil>>>;

/** Uma casa abaixo de 10% (taxa de clique), inteiro acima. */
const pct = (v: number | null) => (v === null ? "—" : v < 0.1 ? `${(v * 100).toFixed(1).replace(".", ",")}%` : `${Math.round(v * 100)}%`);
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");
const moeda = (v: number | null) => (v === null ? "—" : formatarMoeda(v));
const parte = (a: number, b: number) => (b ? a / b : null);

const SITUACAO: Record<CartaoDiagnostico["situacao"], { rotulo: string; tom: "active" | "in_progress" | "inactive" | "not_started" }> = {
  abaixo: { rotulo: "Abaixo da média", tom: "inactive" },
  media: { rotulo: "Na média", tom: "in_progress" },
  acima: { rotulo: "Acima da média", tom: "active" },
  sem_amostra: { rotulo: "Amostra pequena", tom: "not_started" },
};

/** O que fazer quando a passagem está abaixo da média (validação humana; nada é automático). */
const ACAO: Record<Hipotese, string> = {
  mensagem: "Teste novos ganchos e criativos e revise a promessa do anúncio: o público vê, mas não clica.",
  pagina: "Confira a velocidade da página no celular e a clareza da oferta e do formulário.",
  rastreio: "Leads da Meta não chegam ao Kommo com a campanha: as taxas do Kommo ficam subestimadas. Use a verificação ponta a ponta no modo Criativos.",
  conexao: "Encurte o tempo até o primeiro contato e reforce a cadência de tentativas (WhatsApp, ligação, horários diferentes).",
  qualificacao: "O anúncio atrai quem não é o público: ajuste a segmentação, deixe explícito para quem é o produto e use perguntas de qualificação no formulário.",
  fechamento: "Revise a oferta e a quebra de objeções (preço, parcelamento, prova social) e o acompanhamento dos qualificados.",
};

// Marketing · detalhe da campanha · aba Funil: a campanha da impressão à venda,
// comparada com a média da BU, com o gargalo, as perdas, a qualidade por
// criativo e público e a origem dos leads (safra: leads criados no período).
export function TelaFunil({ funil }: { funil: Funil }) {
  const semLeads = funil.contagem.leads === 0;
  return (
    <div className="flex flex-col gap-6">
      <CardModulo icone={MdFilterAlt} cor="bg-iconBlue" titulo="Funil da campanha" className="min-w-0">
        <Avisos funil={funil} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <FunilMeta passos={funil.passos.filter((p) => p.fonte === "meta")} gasto={funil.topo.gasto} />
          <FunilKommo passos={funil.passos.filter((p) => p.fonte === "kommo")} custo={funil.custo} contagem={funil.contagem} />
        </div>
      </CardModulo>

      <CardModulo icone={MdTroubleshoot} cor="bg-iconYellow" titulo="Onde está o gargalo" className="min-w-0">
        <p className="-mt-1 text-sm text-gray2">Cada passagem do funil aponta uma causa provável. A comparação é com a média de todas as campanhas da BU no mesmo período.</p>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {funil.cartoes.map((c) => (
            <li key={c.hipotese}>
              <Diagnostico c={c} />
            </li>
          ))}
        </ul>
      </CardModulo>

      {semLeads ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdFilterAlt} titulo="Nenhum lead da campanha no Kommo neste período" descricao="Perdas, qualidade e origem aparecem quando a campanha tiver leads atribuídos." />
        </div>
      ) : (
        <>
          <Perdas funil={funil} />
          <Qualidade funil={funil} />
          <Origem funil={funil} />
        </>
      )}

      <div className="flex gap-2 rounded-xl border border-gray5 bg-surface p-4 text-xs text-gray3">
        <MdInfoOutline className="mt-px size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <span>
            Safra: leads criados no período e atribuídos à campanha. Cada lead conta no maior estágio por onde passou (etapa atual e histórico de etapas do Kommo): perdido depois de qualificado conta como
            qualificado, e etapa que o funil não tem conta como atingida quando o lead passa adiante.
          </span>
          <span>Estágios de cada etapa do Kommo em Configurações → Marketing. Topo do funil (impressões, cliques, páginas vistas, leads) da Meta, no nível campanha.</span>
        </div>
      </div>
    </div>
  );
}

function Avisos({ funil }: { funil: Funil }) {
  const rastreio = funil.cartoes.find((c) => c.hipotese === "rastreio");
  const avisos = [
    ...(funil.safraImatura ? [`${inteiro(funil.contagem.abertos)} dos ${inteiro(funil.contagem.leads)} leads ainda estão em andamento: vendas e perdas desta safra ainda vão mudar.`] : []),
    ...(rastreio?.situacao === "abaixo" ? [`${rastreio.evidencias[0]}. As taxas do Kommo ficam subestimadas até o rastreio ser corrigido.`] : []),
  ];
  if (!avisos.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {avisos.map((a) => (
        <li key={a} className="flex items-start gap-2 rounded-lg bg-orange3 px-3 py-2 text-[13px] text-darkPurple1">
          <MdWarningAmber className="mt-0.5 size-4 shrink-0 text-orange2" aria-hidden />
          {a}
        </li>
      ))}
    </ul>
  );
}

/** Taxa da passagem com a média da BU; seta e cor quando foge ±15% da média. */
function Taxa({ taxa, taxaBu }: { taxa: number | null; taxaBu: number | null }) {
  const i = taxa !== null && taxaBu ? taxa / taxaBu : null;
  const abaixo = i !== null && i < 0.85;
  const acima = i !== null && i > 1.15;
  const Seta = abaixo ? MdArrowDownward : acima ? MdArrowUpward : null;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={cn("inline-flex items-center gap-0.5 text-sm font-bold", abaixo ? "text-red" : acima ? "text-green1" : "text-darkPurple1")}>
        {Seta && <Seta className="size-3.5" aria-label={abaixo ? "abaixo da média" : "acima da média"} />}
        {pct(taxa)}
      </span>
      <span className="text-[11px] text-gray3">BU {pct(taxaBu)}</span>
    </span>
  );
}

/** Topo do funil na Meta: os números variam em ordens de grandeza, então degraus com a taxa entre eles (sem barras). */
function FunilMeta({ passos, gasto }: { passos: PassoFunil[]; gasto: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Na Meta · {formatarMoeda(gasto)} investidos</span>
      <ol className="flex flex-col">
        {passos.map((p, i) => (
          <li key={p.id} className="flex flex-col">
            {i > 0 && (
              <div className="flex items-center justify-between gap-3 py-1 pl-4">
                <span className="border-l-2 border-gray5 py-1 pl-3 text-xs text-gray3">conversão</span>
                <Taxa taxa={p.taxa} taxaBu={p.taxaBu} />
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-hover px-3 py-2">
              <span className="text-sm text-gray2">{p.rotulo}</span>
              <span className="text-base font-bold text-darkPurple1">{inteiro(p.valor)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Funil no Kommo: barras proporcionais aos leads da safra, com a conversão de cada passagem. */
function FunilKommo({ passos, custo, contagem }: { passos: PassoFunil[]; custo: Funil["custo"]; contagem: Funil["contagem"] }) {
  const topo = passos[0]?.valor || 1;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">No Kommo · leads criados no período</span>
      <ol className="flex flex-col gap-1.5">
        {passos.map((p, i) => (
          <li
            key={p.id}
            className="grid grid-cols-[112px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)_72px]"
            title={i === 0 ? `${inteiro(p.valor)} leads no Kommo · ${pct(p.taxa)} dos leads da Meta` : `${inteiro(p.valor)} leads · ${pct(p.taxa)} da etapa anterior (média da BU ${pct(p.taxaBu)})`}
          >
            <span className="truncate text-sm text-gray2">{p.rotulo}</span>
            <span className="flex h-7 items-center gap-2">
              <span className="h-full min-w-1 rounded-r bg-iconBlue" style={{ width: `${(p.valor / topo) * 100}%` }} />
              <span className="text-sm font-bold text-darkPurple1">{inteiro(p.valor)}</span>
            </span>
            {i === 0 ? <span className="text-right text-[11px] text-gray3">{pct(p.taxa)} da Meta</span> : <Taxa taxa={p.taxa} taxaBu={p.taxaBu} />}
          </li>
        ))}
      </ol>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-gray5 pt-3 sm:grid-cols-4">
        <Numero rotulo="Custo por lead" valor={moeda(custo.porLead)} />
        <Numero rotulo="Custo por qualificado" valor={moeda(custo.porQualificado)} apoio={`BU ${moeda(custo.porQualificadoBu)}`} />
        <Numero rotulo="Custo por venda" valor={moeda(custo.porVenda)} />
        <Numero rotulo="Em andamento" valor={inteiro(contagem.abertos)} apoio={`${inteiro(contagem.perdidos)} perdidos`} />
      </dl>
    </div>
  );
}

function Numero({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{rotulo}</dt>
      <dd className="text-sm font-semibold text-darkPurple1">
        {valor}
        {apoio && <span className="ml-1.5 text-xs font-normal text-gray3">{apoio}</span>}
      </dd>
    </div>
  );
}

function Diagnostico({ c }: { c: CartaoDiagnostico }) {
  const s = c.hipotese === "rastreio" && c.situacao === "abaixo" ? { rotulo: "Perda de rastreio", tom: "pending" as const } : SITUACAO[c.situacao];
  return (
    <article className={cn("flex h-full flex-col gap-2 rounded-xl border p-4", c.gargalo ? "border-red bg-surface shadow-card" : "border-gray5")}>
      <div className="flex flex-wrap items-center gap-1.5">
        {c.gargalo && (
          <StatusPill tom="inactive" className="gap-1 pl-2">
            <MdFlag className="size-3.5" aria-hidden />
            Gargalo
          </StatusPill>
        )}
        <StatusPill tom={s.tom}>{s.rotulo}</StatusPill>
      </div>
      <h3 className="text-[15px] font-bold text-darkPurple1">{c.titulo}</h3>
      <p className="text-xs text-gray3">{c.pergunta}</p>
      <ul className="flex flex-col gap-1 text-[13px] text-gray2">
        {c.evidencias.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {c.situacao === "abaixo" && (
        <p className="mt-auto border-t border-gray5 pt-2 text-[13px] text-gray2">
          <strong className="font-semibold text-darkPurple1">O que fazer: </strong>
          {ACAO[c.hipotese]}
        </p>
      )}
    </article>
  );
}

/** Barra fina de proporção com o percentual ao lado (uma série, cor única). */
function BarraParte({ valor }: { valor: number | null }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray5">
        <span className="block h-full rounded-full bg-iconBlue" style={{ width: `${Math.round((valor ?? 0) * 100)}%` }} />
      </span>
      <span className="text-[13px] font-semibold text-darkPurple1">{pct(valor)}</span>
    </span>
  );
}

function Perdas({ funil }: { funil: Funil }) {
  const semMotivo = funil.perdas.find((p) => p.id === null);
  return (
    <CardModulo icone={MdTrendingDown} cor="bg-iconRed" titulo={`Perdas por motivo · ${inteiro(funil.contagem.perdidos)} leads perdidos`} className="min-w-0">
      {funil.perdas.length === 0 ? (
        <p className="text-sm text-gray3">Nenhum lead perdido nesta safra.</p>
      ) : (
        <>
          <Table minWidth={720}>
            <TableHeader>
              <TableRow>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Perdidos</TableHead>
                <TableHead>Das perdas</TableHead>
                <TableHead className="text-right">Média BU</TableHead>
                <TableHead className="text-right" title="Perdidos antes de conectar (entrada ou tentativa de contato)">
                  Antes de conectar
                </TableHead>
                <TableHead className="text-right">Depois de conectar</TableHead>
                <TableHead className="text-right" title="Perdidos depois de qualificado (oferta e negociação incluídas)">
                  Depois de qualificar
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funil.perdas.map((p) => (
                <TableRow key={p.id ?? "sem"}>
                  <TableCell className={cn("font-semibold", p.id === null ? "text-gray3" : "text-darkPurple1")}>{p.nome}</TableCell>
                  <TableCell className="text-right text-gray2">{inteiro(p.total)}</TableCell>
                  <TableCell>
                    <BarraParte valor={p.parte} />
                  </TableCell>
                  <TableCell className="text-right text-gray3">{pct(p.parteBu)}</TableCell>
                  <TableCell className="text-right text-gray2">{inteiro(p.onde.antes)}</TableCell>
                  <TableCell className="text-right text-gray2">{inteiro(p.onde.conectado)}</TableCell>
                  <TableCell className="text-right text-gray2">{inteiro(p.onde.qualificado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-gray3">
            Onde parou: o maior estágio do lead antes da perda. Perda antes de conectar é problema de contato; perda depois de qualificar é objeção de compra.
            {semMotivo && semMotivo.parte !== null && semMotivo.parte > 0.2 && ` ${pct(semMotivo.parte)} das perdas estão sem motivo no Kommo — tornar o motivo obrigatório deixa este quadro confiável.`}
          </p>
        </>
      )}
    </CardModulo>
  );
}

function Qualidade({ funil }: { funil: Funil }) {
  return (
    <CardModulo icone={MdGroups} cor="bg-iconGreen" titulo="Qualidade dos leads por criativo e público" className="min-w-0">
      <p className="-mt-1 text-sm text-gray2">Lead barato que não conecta nem qualifica sai caro. Compare as taxas de cada criativo e conjunto com as da campanha (aqui, todas sobre o total de leads).</p>
      <TabelaQualidade titulo="Criativo" linhas={funil.qualidade.criativos} total={funil.passos} />
      <TabelaQualidade titulo="Público (conjunto de anúncios)" linhas={funil.qualidade.publicos} total={funil.passos} />
    </CardModulo>
  );
}

function TabelaQualidade({ titulo, linhas, total }: { titulo: string; linhas: LinhaQualidade[]; total: PassoFunil[] }) {
  const valor = (id: PassoFunil["id"]) => total.find((p) => p.id === id)?.valor ?? 0;
  const conexaoCampanha = parte(valor("conectado"), valor("leadsCrm"));
  const qualifCampanha = parte(valor("qualificado"), valor("leadsCrm"));
  // Destaca só com amostra (10+ leads) e fora de ±15% da campanha.
  const tom = (v: number | null, ref: number | null, leads: number) =>
    v === null || ref === null || !ref || leads < 10 ? "text-gray2" : v < ref * 0.85 ? "font-semibold text-red" : v > ref * 1.15 ? "font-semibold text-green1" : "text-gray2";
  return (
    <Table minWidth={960}>
      <TableHeader>
        <TableRow>
          <TableHead>{titulo}</TableHead>
          <TableHead className="text-right">Gasto</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right" title="Dos leads do criativo/público">
            Conectaram
          </TableHead>
          <TableHead className="text-right" title="Dos leads do criativo/público (no diagnóstico, a taxa é sobre os conectados)">
            Qualificaram
          </TableHead>
          <TableHead className="text-right">Vendas</TableHead>
          <TableHead className="text-right">Custo por qualificado</TableHead>
          <TableHead className="text-right" title="Dos leads perdidos">
            Fora do Perfil
          </TableHead>
          <TableHead className="text-right" title="Dos leads perdidos">
            Falta de Conexão
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((q) => {
          const conexao = parte(q.conectado, q.leads);
          const qualif = parte(q.qualificado, q.leads);
          return (
            <TableRow key={q.chave}>
              <TableCell className={cn("max-w-[260px] truncate font-semibold", q.chave === "-" ? "text-gray3" : "text-darkPurple1")} title={q.nome}>
                {q.nome}
              </TableCell>
              <TableCell className="text-right text-gray2">{q.gasto ? formatarMoeda(q.gasto) : "—"}</TableCell>
              <TableCell className="text-right text-gray2">{inteiro(q.leads)}</TableCell>
              <TableCell className={cn("text-right", tom(conexao, conexaoCampanha, q.leads))}>{pct(conexao)}</TableCell>
              <TableCell className={cn("text-right", tom(qualif, qualifCampanha, q.leads))}>{pct(qualif)}</TableCell>
              <TableCell className="text-right text-gray2">{inteiro(q.vendas)}</TableCell>
              <TableCell className="text-right text-gray2">{q.qualificado && q.gasto ? formatarMoeda(q.gasto / q.qualificado) : "—"}</TableCell>
              <TableCell className="text-right text-gray2">{pct(parte(q.foraDoPerfil, q.perdidos))}</TableCell>
              <TableCell className="text-right text-gray2">{pct(parte(q.faltaConexao, q.perdidos))}</TableCell>
            </TableRow>
          );
        })}
        <TableRow>
          <TableCell className="font-bold text-darkPurple1">Campanha</TableCell>
          <TableCell />
          <TableCell className="text-right font-bold text-darkPurple1">{inteiro(valor("leadsCrm"))}</TableCell>
          <TableCell className="text-right font-bold text-darkPurple1">{pct(conexaoCampanha)}</TableCell>
          <TableCell className="text-right font-bold text-darkPurple1">{pct(qualifCampanha)}</TableCell>
          <TableCell className="text-right font-bold text-darkPurple1">{inteiro(valor("vendas"))}</TableCell>
          <TableCell colSpan={3} />
        </TableRow>
      </TableBody>
    </Table>
  );
}

function Origem({ funil }: { funil: Funil }) {
  const { fonte, funil: funis, toque } = funil.origem;
  const total = funil.contagem.leads;
  const toques = [
    { nome: "Primeiro e último toque nesta campanha", total: toque.mesmaCampanha },
    { nome: "Primeiro toque em outra campanha", total: toque.primeiroEmOutra },
    { nome: "Só o primeiro toque (sem UTMs de último toque)", total: toque.soPrimeiro },
    { nome: "Último toque aqui, sem primeiro toque registrado", total: toque.semPrimeiro },
  ].filter((t) => t.total > 0);
  return (
    <CardModulo icone={MdAltRoute} cor="bg-iconPurple" titulo="Origem dos leads" className="min-w-0">
      <div className="grid gap-6 md:grid-cols-3">
        <ListaOrigem titulo="Fonte (utm_source)" itens={fonte} total={total} />
        <ListaOrigem titulo="Toque de atribuição" itens={toques} total={total} />
        <ListaOrigem titulo="Funil do Kommo" itens={funis} total={total} />
      </div>
    </CardModulo>
  );
}

function ListaOrigem({ titulo, itens, total }: { titulo: string; itens: { nome: string; total: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{titulo}</span>
      <ul className="flex flex-col gap-2">
        {itens.slice(0, 6).map((i) => (
          <li key={i.nome} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-gray2" title={i.nome}>
                {i.nome}
              </span>
              <span className="shrink-0 font-semibold text-darkPurple1">
                {inteiro(i.total)} <span className="font-normal text-gray3">· {pct(parte(i.total, total))}</span>
              </span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-gray5">
              <span className="block h-full rounded-full bg-iconBlue" style={{ width: `${Math.round((parte(i.total, total) ?? 0) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

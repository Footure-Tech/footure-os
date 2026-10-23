import Link from "next/link";
import { MdChecklist, MdEventNote, MdInfoOutline, MdShowChart, MdWarning } from "react-icons/md";
import type { carregarPainel } from "@/lib/controladoria/consultas";
import { rotuloMes } from "@/lib/controladoria/modelo";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta, tempoDecorrido } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { DivisaoValores, GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo } from "@/components/negocio/card-modulo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoAtualizarDados } from "./acoes";
import { ROTULO_GRUPO, SEVERIDADE_VISUAL } from "./visual";

type Dados = Awaited<ReturnType<typeof carregarPainel>>;

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
const meses = (n: number) => `${n.toFixed(1).replace(".", ",")} ${n >= 1 && n < 2 ? "mês" : "meses"}`;

function Aviso({ children, href, tom = "atencao" }: { children: React.ReactNode; href?: string; tom?: "atencao" | "info" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-5 py-3.5 text-sm",
        tom === "atencao" ? "border-orange/40 bg-orange3 text-[#ce9232]" : "border-[#0288d1]/30 bg-[#e1f5fe] text-[#0288d1]",
      )}
    >
      {tom === "atencao" ? <MdWarning className="mt-0.5 size-[18px] shrink-0" /> : <MdInfoOutline className="mt-0.5 size-[18px] shrink-0" />}
      <div className="font-semibold">
        {children}
        {href && (
          <Link href={href} className="ml-1.5 underline underline-offset-2">
            Resolver
          </Link>
        )}
      </div>
    </div>
  );
}

// Controladoria · Painel do CFO (spec §3.1): caixa, compromissos e o que pede ação.
export function TelaPainel({ dados }: { dados: Dados }) {
  const { caixa, recebiveis, mes, agenda, saude, mrr, alertas, premissas } = dados;
  const exec = saude.ultimaExecucao;
  const semSaldos = !caixa.dataBase;
  const abaixoColchao = caixa.minimo !== null && caixa.minimo.saldo < caixa.colchao;
  const saldoMes = mes.entradasPrevistas - mes.saidasPrevistas;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Controladoria"
        titulo="Painel do CFO"
        descricao={
          exec
            ? `Caixa, compromissos e alertas · dados do Bling ${exec.status === "rodando" ? "sendo atualizados" : tempoDecorrido(exec.terminado_em ?? exec.iniciado_em)}`
            : "Caixa, compromissos e alertas · os dados do Bling ainda não foram carregados"
        }
        acoes={<BotaoAtualizarDados />}
      />

      {!exec && <Aviso>Primeiro passo: clique em “Atualizar dados do Bling”. A carga inicial leva algumas execuções (cada uma detalha algumas centenas de lançamentos).</Aviso>}
      {semSaldos && exec && (
        <Aviso href="/controladoria/premissas">Informe os saldos das contas (Premissas) para ligar a posição e a projeção de caixa. As contas da Footure no Bling são manuais.</Aviso>
      )}
      {saude.pendentesDetalhe > 0 && (
        <Aviso tom="info">
          Carga inicial em andamento: {saude.pendentesDetalhe} lançamentos ainda sem detalhe (categoria e conta). Rode “Atualizar dados do Bling” até zerar ou aguarde as sincronizações
          automáticas (5h e 16h).
        </Aviso>
      )}

      <GradeKpis>
        <KpiCard
          rotulo="Caixa disponível"
          valor={caixa.saldoHoje === null ? "—" : formatarMoedaCompacta(caixa.saldoHoje)}
          apoio={caixa.dataBase ? `contas + liquidez 1 dia, saldos de ${formatarDataCurta(caixa.dataBase)}` : "informe os saldos"}
          rodape={
            caixa.dataBase ? (
              <DivisaoValores
                partes={[
                  { rotulo: "Contas", valor: caixa.disponivel },
                  { rotulo: "Liquidez 1 dia", valor: caixa.liquidez },
                  ...(caixa.saldoHoje !== null && Math.abs(caixa.saldoHoje - caixa.caixa) >= 0.5
                    ? [{ rotulo: `Baixas depois de ${formatarDataCurta(caixa.dataBase)}`, valor: caixa.saldoHoje - caixa.caixa }]
                    : []),
                  { rotulo: "Fora: aplicações", valor: caixa.aplicacao },
                  { rotulo: "Fora: gateways a liquidar", valor: caixa.gateway },
                ]}
              />
            ) : undefined
          }
        />
        <KpiCard
          rotulo="Menor saldo em 30 dias"
          valor={caixa.minimo ? formatarMoedaCompacta(caixa.minimo.saldo) : "—"}
          corValor={caixa.minimo && caixa.minimo.saldo < 0 ? "text-red" : undefined}
          destaque={caixa.minimo ? formatarDataCurta(caixa.minimo.data) : undefined}
          tomDestaque={abaixoColchao ? "negativo" : "positivo"}
          apoio={caixa.minimo ? (abaixoColchao ? "abaixo do colchão" : "acima do colchão") : undefined}
          rodape={`Colchão: ${formatarMoedaCompacta(caixa.colchao)} (${premissas.colchao_meses} meses de saídas)`}
        />
        <KpiCard
          rotulo="Runway"
          valor={caixa.runwayMeses === null ? "Positivo" : meses(caixa.runwayMeses)}
          corValor={caixa.runwayMeses !== null && caixa.runwayMeses < premissas.runway_alerta_meses ? "text-red" : undefined}
          apoio={caixa.queima > 0 ? `queima de ${formatarMoedaCompacta(caixa.queima)}/mês` : "entradas cobrem as saídas"}
          rodape={
            <DivisaoValores
              partes={[
                { rotulo: `Entradas médias (${caixa.mesesBase.map(rotuloMes).join(", ")})`, valor: caixa.entradasMedias },
                { rotulo: "Saídas médias", valor: caixa.saidasMedias },
              ]}
            />
          }
        />
        <KpiCard
          rotulo={`Saldo do mês · ${rotuloMes(mes.mes)}`}
          valor={formatarMoedaCompacta(saldoMes)}
          corValor={saldoMes < 0 ? "text-red" : "text-green1"}
          apoio="entradas − saídas com vencimento no mês"
          rodape={
            <DivisaoValores
              partes={[
                { rotulo: `Entradas (${formatarMoedaCompacta(mes.entradasRealizadas)} recebido)`, valor: mes.entradasPrevistas },
                { rotulo: `Saídas (${formatarMoedaCompacta(mes.saidasRealizadas)} pago)`, valor: mes.saidasPrevistas },
              ]}
            />
          }
        />
        <KpiCard rotulo="MRR Footlink" valor={formatarMoedaCompacta(mrr.mrr)} apoio={`${mrr.contratos} contratos vigentes`} />
        <KpiCard
          rotulo="Recebíveis vencidos"
          valor={formatarMoedaCompacta(recebiveis.total)}
          corValor={recebiveis.ate90 > 0 ? "text-red" : undefined}
          rodape={
            <DivisaoValores
              partes={[
                { rotulo: "Até 90 dias", valor: recebiveis.ate90 },
                { rotulo: "Acima de 90 dias", valor: recebiveis.de91 },
              ]}
            />
          }
        />
      </GradeKpis>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <CardModulo
          icone={MdChecklist}
          cor="bg-iconRed"
          titulo="O que precisa de você"
          extra={
            <Link href="/controladoria/alertas" className="text-sm font-semibold text-purple-text hover:underline">
              Todos os alertas ({alertas.length})
            </Link>
          }
        >
          {alertas.length === 0 ? (
            <EstadoVazio compacto titulo="Nada pendente" descricao="Nenhum alerta aberto agora." />
          ) : (
            <div className="flex flex-col divide-y divide-gray5">
              {alertas.slice(0, 6).map((a) => (
                <div key={a.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tom={SEVERIDADE_VISUAL[a.severidade].tom}>{SEVERIDADE_VISUAL[a.severidade].rotulo}</StatusPill>
                    <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{ROTULO_GRUPO[a.grupo]}</span>
                  </div>
                  <span className="text-sm font-bold text-darkPurple1">{a.titulo}</span>
                  <span className="text-[13px] text-gray2">
                    <strong className="font-semibold text-darkPurple1">O que fazer:</strong> {a.acao}
                    {a.href && (
                      <Link href={a.href} className="ml-1.5 font-semibold text-purple-text hover:underline">
                        Abrir
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardModulo>

        <CardModulo
          icone={MdShowChart}
          cor="bg-iconBlue"
          titulo="Próximas 4 semanas"
          extra={
            <Link href="/controladoria/caixa" className="text-sm font-semibold text-purple-text hover:underline">
              Fluxo de caixa
            </Link>
          }
        >
          {caixa.semanas.length === 0 ? (
            <EstadoVazio compacto titulo="Sem projeção" descricao="Informe os saldos das contas para projetar o caixa." />
          ) : (
            <>
              <div className="flex flex-col divide-y divide-gray5 text-sm">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pb-2 text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
                  <span>Semana</span>
                  <span className="text-right">Entradas</span>
                  <span className="text-right">Saídas</span>
                  <span className="text-right">Saldo</span>
                </div>
                {caixa.semanas.map((s) => (
                  <div key={s.inicio} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-2.5">
                    <span className="text-gray2">
                      {formatarDataCurta(s.inicio)} a {formatarDataCurta(s.fim)}
                    </span>
                    <span className="text-right font-semibold text-green1">{formatarMoedaCompacta(s.entradas)}</span>
                    <span className="text-right font-semibold text-red">{formatarMoedaCompacta(s.saidas)}</span>
                    <span className={cn("text-right font-bold", s.saldoFinal < caixa.colchao ? "text-red" : "text-darkPurple1")}>{formatarMoedaCompacta(s.saldoFinal)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray3">
                Só o que já está lançado no Bling: sem vendas novas e sem os recebíveis vencidos. Contas a pagar vencidas entram hoje.
              </p>
            </>
          )}
        </CardModulo>
      </div>

      <CardModulo icone={MdEventNote} cor="bg-iconYellow" titulo="Agenda dos próximos 7 dias">
        {agenda.pagarVencidos.length > 0 && (
          <Aviso href="/controladoria/pagar">
            {agenda.pagarVencidos.length} {agenda.pagarVencidos.length === 1 ? "conta a pagar vencida" : "contas a pagar vencidas"} ·{" "}
            {formatarMoeda(agenda.pagarVencidos.reduce((s, l) => s + l.aberto, 0))}
          </Aviso>
        )}
        <Table minWidth={760}>
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead>A pagar</TableHead>
              <TableHead>A receber</TableHead>
              <TableHead className="text-right">Saldo do dia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agenda.porDia.map((d) => {
              const pagar = d.pagar.reduce((s, l) => s + l.aberto, 0);
              const receber = d.receber.reduce((s, l) => s + l.aberto, 0);
              return (
                <TableRow key={d.data}>
                  <TableCell className="font-semibold whitespace-nowrap text-darkPurple1">
                    {diaSemana(d.data)} · {formatarDataCurta(d.data)}
                  </TableCell>
                  <TableCell className="max-w-[340px] whitespace-normal">
                    {d.pagar.length ? (
                      <>
                        <span className="font-semibold text-red">{formatarMoeda(pagar)}</span>
                        <span className="block text-xs text-gray3">
                          {d.pagar
                            .slice(0, 3)
                            .map((l) => l.nome)
                            .join(", ")}
                          {d.pagar.length > 3 ? ` e mais ${d.pagar.length - 3}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray3">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[340px] whitespace-normal">
                    {d.receber.length ? (
                      <>
                        <span className="font-semibold text-green1">{formatarMoeda(receber)}</span>
                        <span className="block text-xs text-gray3">
                          {d.receber.length} {d.receber.length === 1 ? "parcela" : "parcelas"}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray3">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right font-bold", receber - pagar < 0 ? "text-red" : "text-darkPurple1")}>
                    {d.pagar.length || d.receber.length ? formatarMoeda(receber - pagar) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardModulo>

      <CardModulo icone={MdInfoOutline} cor="bg-iconGray" titulo="Saúde dos dados">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 text-sm">
          <div>
            <span className="block text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Última sincronização</span>
            <span className="font-semibold text-darkPurple1">
              {exec ? `${exec.status === "erro" ? "Falhou" : exec.status === "rodando" ? "Rodando" : "OK"} · ${tempoDecorrido(exec.terminado_em ?? exec.iniciado_em)}` : "Nunca"}
            </span>
            {exec?.status === "erro" && exec.erro && <span className="block text-xs text-red">{exec.erro}</span>}
          </div>
          <div>
            <span className="block text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Lançamentos com categoria (12 meses)</span>
            <span className="font-semibold text-darkPurple1">{saude.pctCategorizado === null ? "—" : `${(saude.pctCategorizado * 100).toFixed(1).replace(".", ",")}%`}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Detalhes pendentes</span>
            <span className="font-semibold text-darkPurple1">{saude.pendentesDetalhe}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Saldos das contas</span>
            <span className="font-semibold text-darkPurple1">
              {caixa.dataBase ? `informados em ${formatarDataCurta(caixa.dataBase)}` : "não informados"}
              {caixa.contasDesatualizadas.length ? ` · ${caixa.contasDesatualizadas.length} desatualizada(s)` : ""}
            </span>
          </div>
        </div>
      </CardModulo>
    </div>
  );
}

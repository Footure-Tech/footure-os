import Link from "next/link";
import { MdCalendarViewWeek, MdInfoOutline, MdViewTimeline } from "react-icons/md";
import type { carregarTelaCaixa } from "@/lib/controladoria/consultas";
import type { CenarioCaixa } from "@/lib/controladoria/fluxoCaixa";
import { rotuloMes } from "@/lib/controladoria/modelo";
import { formatarDataCurta, formatarMoedaCompacta } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { CardModulo } from "@/components/negocio/card-modulo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Dados = Awaited<ReturnType<typeof carregarTelaCaixa>>;

const valor = (v: number | null) => (v === null ? "" : Math.abs(v) < 0.5 ? "—" : formatarMoedaCompacta(v));

function Linha({ rotulo, valores, destaque, detalhe, cor }: { rotulo: string; valores: (number | null)[]; destaque?: boolean; detalhe?: boolean; cor?: (v: number) => string }) {
  return (
    <TableRow className={cn(destaque && "bg-light/60")}>
      <TableCell className={cn("sticky left-0 z-10 bg-card whitespace-normal", destaque && "bg-light/60", detalhe ? "pl-9 text-[13px] text-gray2" : "font-bold text-darkPurple1")}>{rotulo}</TableCell>
      {valores.map((v, i) => (
        <TableCell key={i} className={cn("text-right whitespace-nowrap", detalhe ? "text-[13px] text-gray2" : "font-semibold", v !== null && cor ? cor(v) : !detalhe && "text-darkPurple1")}>
          {valor(v)}
        </TableCell>
      ))}
    </TableRow>
  );
}

// Controladoria · Caixa (spec §3.2): fluxo mensal realizado × projetado e as próximas 13 semanas.
export function TelaCaixa({ dados, cenario }: { dados: Dados; cenario: CenarioCaixa }) {
  const { meses, mesAtual, entradas, saidas, operacional, emprestimos, distribuicao, variacao, saldoFimDoMes, faltaColchao, semanas, menorSemana, saldoHoje, dataBase, colchao } = dados;
  const sinal = (v: number) => (v < 0 ? "text-red" : "text-green1");
  const maiorFalta = Math.max(0, ...faltaColchao.map((v) => v ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Controladoria"
        titulo="Caixa"
        descricao="Fluxo pelo vencimento: realizado nos meses passados e projetado com o que já está lançado no Bling (sem vendas novas)."
        acoes={
          <SegmentedToggle
            valor={cenario}
            opcoes={[
              { valor: "base", rotulo: "Cenário base", href: "/controladoria/caixa" },
              { valor: "conservador", rotulo: "Conservador", href: "/controladoria/caixa?cenario=conservador" },
            ]}
          />
        }
      />

      {!dataBase && (
        <div className="flex items-start gap-2.5 rounded-xl border border-orange/40 bg-orange3 px-5 py-3.5 text-sm font-semibold text-[#ce9232]">
          <MdInfoOutline className="mt-0.5 size-[18px] shrink-0" />
          <span>
            Sem saldos informados, o fluxo aparece, mas sem os saldos projetados.{" "}
            <Link href="/controladoria/premissas" className="underline underline-offset-2">
              Informar os saldos
            </Link>
          </span>
        </div>
      )}

      <GradeKpis>
        <KpiCard rotulo="Caixa hoje" valor={saldoHoje === null ? "—" : formatarMoedaCompacta(saldoHoje)} apoio={dataBase ? `saldos de ${formatarDataCurta(dataBase)}` : "informe os saldos"} />
        <KpiCard
          rotulo="Menor saldo em 13 semanas"
          valor={menorSemana ? formatarMoedaCompacta(menorSemana.saldoFinal) : "—"}
          corValor={menorSemana && menorSemana.saldoFinal < colchao ? "text-red" : undefined}
          apoio={menorSemana ? `semana de ${formatarDataCurta(menorSemana.inicio)}` : undefined}
          rodape={`Colchão: ${formatarMoedaCompacta(colchao)}`}
        />
        <KpiCard
          rotulo="Vendas novas para o colchão"
          valor={formatarMoedaCompacta(maiorFalta)}
          corValor={maiorFalta > 0 ? "text-red" : "text-green1"}
          apoio={maiorFalta > 0 ? "a receber até o pior mês projetado" : "o colchão se mantém"}
        />
        <KpiCard
          rotulo="Inadimplência observada"
          valor={`${(dados.inadimplencia * 100).toFixed(1).replace(".", ",")}%`}
          apoio="vencido há 30–180 dias e ainda em aberto"
          rodape={cenario === "conservador" ? "Aplicada às entradas projetadas" : "Use o cenário conservador para aplicá-la"}
        />
      </GradeKpis>

      <CardModulo icone={MdViewTimeline} cor="bg-iconGreen" titulo="Fluxo mensal">
        <Table minWidth={1300}>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-[260px] bg-card">Movimento</TableHead>
              {meses.map((m) => (
                <TableHead key={m} className={cn("text-right", m === mesAtual && "text-purple-text")}>
                  {rotuloMes(m)}
                  <span className="block text-[10px] font-semibold normal-case">{m < mesAtual ? "realizado" : m === mesAtual ? "atual" : "projetado"}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <Linha rotulo="Entradas operacionais" valores={entradas.valores} cor={() => "text-green1"} />
            {entradas.itens.slice(0, 8).map((d) => (
              <Linha key={`e:${d.rotulo}`} rotulo={d.rotulo} valores={d.valores} detalhe />
            ))}
            <Linha rotulo="Saídas operacionais" valores={saidas.valores} cor={() => "text-red"} />
            {saidas.itens.slice(0, 10).map((d) => (
              <Linha key={`s:${d.rotulo}`} rotulo={d.rotulo} valores={d.valores} detalhe />
            ))}
            <Linha rotulo="= Geração de caixa operacional" valores={operacional} destaque cor={sinal} />
            <Linha rotulo="Empréstimos (entradas − amortizações e juros)" valores={emprestimos.valores} cor={sinal} />
            <Linha rotulo="Distribuição de lucros" valores={distribuicao.valores} cor={sinal} />
            <Linha rotulo="= Variação do caixa" valores={variacao} destaque cor={sinal} />
            <Linha rotulo="Saldo projetado no fim do mês" valores={saldoFimDoMes} destaque cor={(v) => (v < colchao ? "text-red" : "text-darkPurple1")} />
            <Linha rotulo="Falta para o colchão" valores={faltaColchao} cor={(v) => (v > 0 ? "text-red" : "text-gray3")} />
          </TableBody>
        </Table>
        <p className="text-xs text-gray3">
          Meses passados: só o que foi pago ou recebido. Mês atual e futuros: o realizado mais o que está em aberto; contas a pagar vencidas saem hoje e recebíveis vencidos (
          {formatarMoedaCompacta(dados.recebiveisVencidos)}) ficam de fora. O cenário conservador desconta a inadimplência observada das entradas.
        </p>
      </CardModulo>

      <CardModulo icone={MdCalendarViewWeek} cor="bg-iconBlue" titulo="Próximas 13 semanas">
        {semanas.length === 0 ? (
          <p className="text-sm text-gray3">Informe os saldos das contas em Premissas para projetar as semanas.</p>
        ) : (
          <Table minWidth={720}>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo no fim</TableHead>
                <TableHead className="text-right">Frente ao colchão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semanas.map((s) => (
                <TableRow key={s.inicio}>
                  <TableCell className="text-gray2">
                    {formatarDataCurta(s.inicio)} a {formatarDataCurta(s.fim)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green1">{valor(s.entradas)}</TableCell>
                  <TableCell className="text-right font-semibold text-red">{valor(-s.saidas)}</TableCell>
                  <TableCell className={cn("text-right font-bold", s.saldoFinal < 0 ? "text-red" : "text-darkPurple1")}>{formatarMoedaCompacta(s.saldoFinal)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", s.saldoFinal < colchao ? "text-red" : "text-green1")}>{formatarMoedaCompacta(s.saldoFinal - colchao)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardModulo>
    </div>
  );
}

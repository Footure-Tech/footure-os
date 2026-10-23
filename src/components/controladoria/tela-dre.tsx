import { MdInfoOutline, MdPieChart, MdTableChart } from "react-icons/md";
import type { carregarTelaDre } from "@/lib/controladoria/consultas";
import type { RegimeDre } from "@/lib/controladoria/dre";
import { rotuloMes } from "@/lib/controladoria/modelo";
import { formatarMoedaCompacta } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { SegmentedToggle } from "@/components/ds/alternadores";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { CardModulo } from "@/components/negocio/card-modulo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabelaDre } from "./tabela-dre";

type Dados = Awaited<ReturnType<typeof carregarTelaDre>>;

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

// Controladoria · DRE gerencial (spec §3.3), últimos 12 meses, sobre o plano de contas do Bling.
export function TelaDre({ dados, regime }: { dados: Dados; regime: RegimeDre }) {
  const { meses, linhas, fora, porLinha, custosSemLinha, pendentesDetalhe } = dados;
  const por = (chave: string) => linhas.find((l) => l.chave === chave)!;
  const receita = por("receita").total;
  const margem = por("margem").total;
  const ebitda = por("ebitda").total;
  const resultado = por("resultado").total;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Controladoria"
        titulo="DRE gerencial"
        descricao={`${rotuloMes(meses[0])} a ${rotuloMes(meses.at(-1)!)} · plano de contas do Bling · ${
          regime === "competencia" ? "pela data de competência" : "só o que foi pago/recebido, pelo vencimento"
        }`}
        acoes={
          <SegmentedToggle
            valor={regime}
            opcoes={[
              { valor: "competencia", rotulo: "Competência", href: "/controladoria/dre" },
              { valor: "caixa", rotulo: "Caixa", href: "/controladoria/dre?regime=caixa" },
            ]}
          />
        }
      />

      {pendentesDetalhe > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#0288d1]/30 bg-[#e1f5fe] px-5 py-3.5 text-sm font-semibold text-[#0288d1]">
          <MdInfoOutline className="mt-0.5 size-[18px] shrink-0" />
          Carga inicial em andamento: {pendentesDetalhe} lançamentos ainda sem categoria detalhada aparecem em “Outras receitas e despesas” até a próxima sincronização.
        </div>
      )}

      <GradeKpis>
        <KpiCard rotulo="Receita bruta · 12 meses" valor={formatarMoedaCompacta(receita)} />
        <KpiCard rotulo="Margem de contribuição" valor={formatarMoedaCompacta(margem)} apoio={pct(receita ? margem / receita : null)} />
        <KpiCard rotulo="EBITDA gerencial" valor={formatarMoedaCompacta(ebitda)} corValor={ebitda < 0 ? "text-red" : "text-green1"} apoio={pct(receita ? ebitda / receita : null)} />
        <KpiCard rotulo="Resultado líquido" valor={formatarMoedaCompacta(resultado)} corValor={resultado < 0 ? "text-red" : "text-green1"} apoio={pct(receita ? resultado / receita : null)} />
      </GradeKpis>

      <CardModulo icone={MdTableChart} cor="bg-iconBlue" titulo="Demonstrativo mês a mês">
        <TabelaDre meses={meses} linhas={linhas} receitaTotal={receita} />
        <p className="text-xs text-gray3">
          Clique numa linha para abrir o detalhe. Transferências entre contas ficam de fora. A fatura do cartão aparece numa linha própria até ser aberta por categoria no Bling.
        </p>
      </CardModulo>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <CardModulo icone={MdPieChart} cor="bg-iconPurple" titulo="Margem por linha de negócio · 12 meses">
          <Table minWidth={620}>
            <TableHeader>
              <TableRow>
                <TableHead>Linha</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Impostos (rateio)</TableHead>
                <TableHead className="text-right">Custos diretos</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porLinha.map((l) => (
                <TableRow key={l.linha}>
                  <TableCell className="font-bold text-darkPurple1">{l.linha}</TableCell>
                  <TableCell className="text-right text-darkPurple1">{formatarMoedaCompacta(l.receita)}</TableCell>
                  <TableCell className="text-right text-gray2">{formatarMoedaCompacta(l.deducoes)}</TableCell>
                  <TableCell className="text-right text-gray2">{formatarMoedaCompacta(l.custos)}</TableCell>
                  <TableCell className={cn("text-right font-bold", l.margem < 0 ? "text-red" : "text-darkPurple1")}>{formatarMoedaCompacta(l.margem)}</TableCell>
                  <TableCell className="text-right text-gray2">{pct(l.pctMargem)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-gray3">
            Impostos rateados pela receita de cada linha. Pessoal e despesas gerais não são rateados.
            {Math.abs(custosSemLinha) >= 1 && ` Custos diretos sem linha definida (ex.: “Geral”): ${formatarMoedaCompacta(custosSemLinha)}.`}
          </p>
        </CardModulo>

        <CardModulo icone={MdInfoOutline} cor="bg-iconGray" titulo="Fora do resultado · 12 meses">
          {fora.detalhes.length === 0 ? (
            <p className="text-sm text-gray3">Nenhum movimento de distribuição de lucros ou empréstimos no período.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray5 text-sm">
              {fora.detalhes.map((d) => (
                <div key={d.rotulo} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="text-gray2">{d.rotulo}</span>
                  <span className={cn("font-bold", d.total < 0 ? "text-red" : "text-green1")}>{formatarMoedaCompacta(d.total)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray3">Distribuição de lucros e empréstimos movem o caixa, mas não são receita nem despesa. Veja o efeito no Caixa.</p>
        </CardModulo>
      </div>
    </div>
  );
}

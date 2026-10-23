import { MdCalendarMonth, MdPayments, MdStorefront } from "react-icons/md";
import type { carregarTelaPagar } from "@/lib/controladoria/consultas";
import type { Lancamento } from "@/lib/controladoria/indicadores";
import { rotuloMes } from "@/lib/controladoria/modelo";
import { formatarDataCurta, formatarMoeda, formatarMoedaCompacta } from "@/lib/formatacao";
import { PageHeader } from "@/components/shell/page-header";
import { GradeKpis, KpiCard } from "@/components/ds/kpi-card";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { CardModulo } from "@/components/negocio/card-modulo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Dados = Awaited<ReturnType<typeof carregarTelaPagar>>;

const OCORRENCIA: Record<number, string> = { 1: "Única", 3: "Parcelada", 5: "Recorrente", 7: "Recorrente" };
const total = (itens: Lancamento[]) => itens.reduce((s, l) => s + l.aberto, 0);

function TabelaAbertos({ titulo, itens, destaque }: { titulo: string; itens: Lancamento[]; destaque?: boolean }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="flex items-baseline gap-2 text-base font-bold text-darkPurple1">
        {titulo}
        <span className={destaque ? "text-sm font-semibold text-red" : "text-sm font-semibold text-gray2"}>
          {itens.length} · {formatarMoeda(total(itens))}
        </span>
      </h3>
      <Table minWidth={980}>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Conta · forma</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((l) => (
            <TableRow key={l.id}>
              <TableCell className={destaque ? "font-semibold whitespace-nowrap text-red" : "whitespace-nowrap text-gray2"}>{formatarDataCurta(l.vencimento)}</TableCell>
              <TableCell className="max-w-[260px] whitespace-normal">
                <span className="font-bold text-darkPurple1">{l.nome}</span>
                {l.historico && <span className="block text-xs text-gray3">{l.historico}</span>}
              </TableCell>
              <TableCell className="max-w-[280px] text-xs whitespace-normal text-gray2">{l.categoria?.caminho ?? <span className="font-semibold text-red">sem categoria</span>}</TableCell>
              <TableCell className="max-w-[200px] text-xs whitespace-normal text-gray2">{[l.conta?.descricao, l.forma?.descricao].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="text-xs text-gray2">{l.ocorrencia_tipo ? (OCORRENCIA[l.ocorrencia_tipo] ?? "—") : "—"}</TableCell>
              <TableCell className="text-right font-semibold text-darkPurple1">{formatarMoeda(l.aberto)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Controladoria · Contas a pagar (spec §3.5): agenda em aberto, gastos por grupo e maiores fornecedores.
export function TelaPagar({ dados }: { dados: Dados }) {
  const { vencidos, proximos7, depois, meses, grupos, fornecedores } = dados;
  const totaisMes = meses.map((_, i) => grupos.reduce((s, g) => s + g.valores[i], 0));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader modulo="Controladoria" titulo="Contas a pagar" descricao="Tudo o que a Footure tem a pagar no Bling, de todas as linhas de negócio." />

      <GradeKpis>
        <KpiCard rotulo="Vencidas" valor={formatarMoedaCompacta(total(vencidos))} corValor={vencidos.length ? "text-red" : undefined} apoio={`${vencidos.length} contas`} />
        <KpiCard rotulo="Próximos 7 dias" valor={formatarMoedaCompacta(total(proximos7))} apoio={`${proximos7.length} contas`} />
        <KpiCard rotulo="Em aberto depois" valor={formatarMoedaCompacta(total(depois))} apoio={`${depois.length} contas já lançadas`} />
      </GradeKpis>

      <CardModulo icone={MdPayments} cor="bg-iconRed" titulo="Em aberto">
        {vencidos.length + proximos7.length + depois.length === 0 ? (
          <EstadoVazio compacto titulo="Nenhuma conta a pagar em aberto" />
        ) : (
          <div className="flex flex-col gap-6">
            <TabelaAbertos titulo="Vencidas" itens={vencidos} destaque />
            <TabelaAbertos titulo="Próximos 7 dias" itens={proximos7} />
            <TabelaAbertos titulo="Depois" itens={depois} />
          </div>
        )}
      </CardModulo>

      <CardModulo icone={MdCalendarMonth} cor="bg-iconBlue" titulo="Saídas por grupo · últimos 6 meses (por vencimento)">
        <Table minWidth={900}>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              {meses.map((m) => (
                <TableHead key={m} className="text-right">
                  {rotuloMes(m)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.map((g) => (
              <TableRow key={g.grupo}>
                <TableCell className="font-semibold text-darkPurple1">{g.grupo}</TableCell>
                {g.valores.map((v, i) => (
                  <TableCell key={meses[i]} className="text-right text-gray2">
                    {v ? formatarMoedaCompacta(v) : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-bold text-darkPurple1">Total</TableCell>
              {totaisMes.map((v, i) => (
                <TableCell key={meses[i]} className="text-right font-bold text-darkPurple1">
                  {formatarMoedaCompacta(v)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-xs text-gray3">O mês corrente inclui o que ainda vai vencer. Transferências entre contas ficam de fora.</p>
      </CardModulo>

      <CardModulo icone={MdStorefront} cor="bg-iconPurple" titulo="Maiores fornecedores · 12 meses">
        <Table minWidth={760}>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Categorias</TableHead>
              <TableHead className="text-right">Lançamentos</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.map((f) => (
              <TableRow key={f.nome + f.total}>
                <TableCell className="font-bold text-darkPurple1">{f.nome}</TableCell>
                <TableCell className="max-w-[360px] text-xs whitespace-normal text-gray2">{f.categorias.join(" · ") || "—"}</TableCell>
                <TableCell className="text-right text-gray2">{f.qtd}</TableCell>
                <TableCell className="text-right font-semibold text-darkPurple1">{formatarMoeda(f.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardModulo>
    </div>
  );
}

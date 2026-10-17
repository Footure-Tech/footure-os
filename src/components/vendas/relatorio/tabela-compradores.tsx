"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MdArrowDownward, MdArrowUpward, MdSearch, MdVisibility } from "react-icons/md";
import type { SituacaoVendaAcademy } from "@/lib/academy/vendas";
import { revelarDocumentoAction } from "@/lib/academy/actions";
import { dataCurta } from "@/lib/academy/series";
import { formatarMoeda } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { cn } from "@/lib/utils";

export interface LinhaComprador {
  chave: string;
  blingPedidoId: number;
  numeroPedido: string;
  data: string;
  nome: string;
  documentoMascarado: string | null;
  produto: string;
  valor: number;
  valorPedido: number;
  rateado: boolean;
  formas: string;
  situacao: SituacaoVendaAcademy;
}

const SITUACAO: Record<SituacaoVendaAcademy, { rotulo: string; tom: "active" | "pending" | "inactive" }> = {
  atendido: { rotulo: "Atendido", tom: "active" },
  em_aberto: { rotulo: "Em aberto", tom: "pending" },
  cancelado: { rotulo: "Cancelado", tom: "inactive" },
};
type Ordem = "data" | "nome" | "valor";
const POR_PAGINA = 20;

function Documento({ linha }: { linha: LinhaComprador }) {
  const [revelado, setRevelado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  if (!linha.documentoMascarado) return null;
  if (revelado) return <span className="text-xs text-gray2">{revelado}</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray3">
      {linha.documentoMascarado}
      <button
        type="button"
        disabled={carregando}
        title="Mostrar CPF completo"
        aria-label={`Mostrar CPF completo de ${linha.nome}`}
        className="inline-flex items-center gap-0.5 rounded font-semibold text-purple-text hover:underline focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
        onClick={async () => {
          setCarregando(true);
          const r = await revelarDocumentoAction(linha.blingPedidoId);
          setCarregando(false);
          if (r.erro || !r.documento) return void toast.error("Não foi possível mostrar o documento", { description: r.erro });
          setRevelado(r.documento);
        }}
      >
        <MdVisibility className="size-3.5" />
        Mostrar
      </button>
    </span>
  );
}

function Cabecalho({
  campo,
  ordem,
  onOrdenar,
  children,
}: {
  campo: Ordem;
  ordem: { campo: Ordem; desc: boolean };
  onOrdenar: (campo: Ordem) => void;
  children: string;
}) {
  const ativo = ordem.campo === campo;
  const Seta = ordem.desc ? MdArrowDownward : MdArrowUpward;
  return (
    <TableHead aria-sort={ativo ? (ordem.desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase hover:text-darkPurple1 focus-visible:shadow-focus focus-visible:outline-none"
        onClick={() => onOrdenar(campo)}
      >
        {children}
        {ativo && <Seta className="size-3.5" />}
      </button>
    </TableHead>
  );
}

// Lista de compradores do curso: busca, ordenação e paginação no cliente
// (algumas centenas de linhas por curso). CPF mascarado; o completo só pelo
// "Mostrar" (server action), nunca na URL. Canceladas aparecem marcadas e
// ficam fora dos totais do relatório.
export function TabelaCompradores({ linhas }: { linhas: LinhaComprador[] }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ campo: Ordem; desc: boolean }>({ campo: "data", desc: true });
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const lista = termo ? linhas.filter((l) => [l.nome, l.numeroPedido, l.formas, l.produto].some((t) => t.toLocaleLowerCase("pt-BR").includes(termo))) : linhas;
    const comparar = (a: LinhaComprador, b: LinhaComprador) =>
      ordem.campo === "valor" ? a.valor - b.valor : ordem.campo === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : a.data.localeCompare(b.data) || Number(a.numeroPedido) - Number(b.numeroPedido);
    return [...lista].sort((a, b) => (ordem.desc ? -comparar(a, b) : comparar(a, b)));
  }, [linhas, busca, ordem]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
  const ordenar = (campo: Ordem) => {
    setOrdem((o) => ({ campo, desc: o.campo === campo ? !o.desc : campo !== "nome" }));
    setPagina(0);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-[360px]">
        <MdSearch className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-gray3" />
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          placeholder="Buscar por nome, pedido ou forma de pagamento"
          aria-label="Buscar compradores"
          className="pl-9"
        />
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio compacto icone={MdSearch} titulo="Nenhum comprador encontrado" descricao="Revise a busca ou o período selecionado." />
        </div>
      ) : (
        <Table minWidth={1100}>
          <TableHeader>
            <TableRow>
              <Cabecalho campo="data" ordem={ordem} onOrdenar={ordenar}>Data</Cabecalho>
              <Cabecalho campo="nome" ordem={ordem} onOrdenar={ordenar}>Comprador</Cabecalho>
              <TableHead>Produto (Bling)</TableHead>
              <Cabecalho campo="valor" ordem={ordem} onOrdenar={ordenar}>Valor bruto</Cabecalho>
              <TableHead>Pagamento</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((l) => (
              <TableRow key={l.chave} className={cn(l.situacao === "cancelado" && "opacity-60")}>
                <TableCell className="text-gray2">{dataCurta(l.data)}</TableCell>
                <TableCell className="max-w-[280px] whitespace-normal">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-bold text-darkPurple1">{l.nome}</span>
                    <Documento linha={l} />
                  </div>
                </TableCell>
                <TableCell className="max-w-[300px] whitespace-normal">
                  <div className="flex flex-col">
                    <span className="text-darkPurple1">{l.produto}</span>
                    <span className="text-xs text-gray3">Pedido nº {l.numeroPedido}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className={cn("font-bold text-darkPurple1", l.situacao === "cancelado" && "line-through")}>{formatarMoeda(l.valor)}</span>
                    {l.rateado && <span className="text-xs text-gray3">rateado · pedido de {formatarMoeda(l.valorPedido)}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-gray2">{l.formas}</TableCell>
                <TableCell>
                  <BadgeTom tom={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].rotulo}</BadgeTom>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {filtradas.length > POR_PAGINA && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray2">
          <span>
            {atual * POR_PAGINA + 1}–{Math.min((atual + 1) * POR_PAGINA, filtradas.length)} de {filtradas.length}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="white" disabled={atual === 0} onClick={() => setPagina(atual - 1)}>
              Anterior
            </Button>
            <Button type="button" size="sm" variant="white" disabled={atual >= paginas - 1} onClick={() => setPagina(atual + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { MdChevronRight, MdSearch } from "react-icons/md";
import type { CompradorAcademy } from "@/lib/academy/carteira";
import { dataCurta } from "@/lib/academy/series";
import { formatarMoeda } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { AbasFiltro, SegmentedToggle } from "@/components/ds/alternadores";

type Filtro = "todos" | "recompra" | "atraso";
export type PeriodoClientes = "tudo" | "12m" | "tri" | "mes";
const PERIODOS: { valor: PeriodoClientes; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Todo o histórico" },
  { valor: "12m", rotulo: "12 meses" },
  { valor: "tri", rotulo: "Trimestre" },
  { valor: "mes", rotulo: "Mês" },
];
const POR_PAGINA = 25;

// Clientes do Academy (compradores dos cursos): período (compras e valores
// contam só o que caiu nele), filtros de recompra e de parcela vencida, busca
// por nome ou curso e paginação no cliente.
export function TabelaClientesAcademy({ compradores, inicios }: { compradores: CompradorAcademy[]; inicios: Record<Exclude<PeriodoClientes, "tudo">, string> }) {
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoClientes>("tudo");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(0);

  // Compras e valor de cada comprador no período (compras = pedidos distintos).
  const noPeriodo = useMemo(
    () =>
      compradores
        .map((c) => {
          const vendas = periodo === "tudo" ? c.vendas : c.vendas.filter((v) => v.data >= inicios[periodo]);
          return { ...c, comprasPeriodo: new Set(vendas.map((v) => v.pedido)).size, valorPeriodo: vendas.reduce((s, v) => s + v.valor, 0) };
        })
        .filter((c) => c.comprasPeriodo > 0),
    [compradores, periodo, inicios],
  );
  const contagem = {
    todos: noPeriodo.length,
    recompra: noPeriodo.filter((c) => c.comprasPeriodo > 1).length,
    atraso: noPeriodo.filter((c) => c.emAtraso > 0).length,
  };
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return noPeriodo.filter(
      (c) =>
        (filtro === "todos" || (filtro === "recompra" ? c.comprasPeriodo > 1 : c.emAtraso > 0)) &&
        (!termo || c.nome.toLocaleLowerCase("pt-BR").includes(termo) || c.cursos.some((k) => k.nome.toLocaleLowerCase("pt-BR").includes(termo))),
    );
  }, [noPeriodo, busca, filtro]);
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtrados.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);

  return (
    <div className="flex flex-col gap-3">
      <SegmentedToggle
        valor={periodo}
        onChange={(p) => {
          setPeriodo(p);
          setPagina(0);
        }}
        opcoes={PERIODOS}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AbasFiltro
          valor={filtro}
          onChange={(f) => {
            setFiltro(f);
            setPagina(0);
          }}
          opcoes={[
            { valor: "todos", rotulo: "Todos", contagem: contagem.todos },
            { valor: "recompra", rotulo: "Mais de uma compra", contagem: contagem.recompra },
            { valor: "atraso", rotulo: "Com parcela vencida", contagem: contagem.atraso },
          ]}
        />
        <div className="relative w-full max-w-[360px]">
          <MdSearch className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-gray3" />
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por nome ou curso"
            aria-label="Buscar clientes"
            className="pl-9"
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio compacto icone={MdSearch} titulo="Nenhum cliente encontrado" descricao="Revise a busca ou o filtro." />
        </div>
      ) : (
        <Table minWidth={1000}>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cursos</TableHead>
              <TableHead>{periodo === "tudo" ? "Compras" : "Compras no período"}</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((c) => (
              <LinhaClicavel key={c.contatoId} href={`/clientes/academy/${c.contatoId}`}>
                <TableCell className="max-w-[280px] whitespace-normal">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-bold text-purple-text">{c.nome}</span>
                    {c.documentoMascarado && <span className="text-xs text-gray3">{c.documentoMascarado}</span>}
                  </div>
                </TableCell>
                <TableCell className="max-w-[340px] whitespace-normal text-[13px] text-gray2">
                  {c.cursos.slice(0, 2).map((k) => k.nome).join(" · ")}
                  {c.cursos.length > 2 && <span className="text-gray3"> +{c.cursos.length - 2}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-darkPurple1">{formatarMoeda(c.valorPeriodo)}</span>
                    <span className="text-xs text-gray3">
                      {c.comprasPeriodo} {c.comprasPeriodo === 1 ? "compra" : "compras"}
                      {periodo !== "tudo" && c.compras > c.comprasPeriodo && ` · ${c.compras} no total`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-gray2">{dataCurta(c.ultimaCompra)}</TableCell>
                <TableCell>
                  {c.emAtraso > 0 ? (
                    <div className="flex flex-col items-start gap-1">
                      <StatusPill tom="inactive">Atrasado</StatusPill>
                      <span className="text-xs font-semibold text-red">{formatarMoeda(c.emAtraso)}</span>
                    </div>
                  ) : (
                    <StatusPill tom="active">Em dia</StatusPill>
                  )}
                </TableCell>
                <TableCell>
                  <MdChevronRight className="size-[18px] text-gray3" />
                </TableCell>
              </LinhaClicavel>
            ))}
          </TableBody>
        </Table>
      )}

      {filtrados.length > POR_PAGINA && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray2">
          <span>
            {atual * POR_PAGINA + 1}–{Math.min((atual + 1) * POR_PAGINA, filtrados.length)} de {filtrados.length}
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

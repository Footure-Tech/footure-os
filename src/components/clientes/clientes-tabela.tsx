"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MdBusiness, MdEdit, MdExpandMore, MdPersonAdd } from "react-icons/md";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { LinhaClicavel } from "@/components/ds/linha-clicavel";
import { BarraProgresso } from "@/components/ds/barra-progresso";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { ExcluirClienteDialog } from "@/components/clientes/excluir-cliente-dialog";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { ROTULO_SITUACAO_CLIENTE, type SituacaoCliente } from "@/lib/clientes/situacao";
import { STATUS_CLIENTE_NAO_CADASTRADO, STATUS_CLIENTE_VISUAL } from "@/lib/status/visual";
import type { TipoCliente } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export interface ClienteLinha {
  blingContatoId: number;
  clienteId: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipo: TipoCliente | null;
  totalPedidosLocais: number;
  totalParcelas: number;
  parcelasEmitidas: number;
  parcelasAtrasadas: number;
  situacao: SituacaoCliente;
  cadastradoNoSistema: boolean;
  logoUrl: string | null;
}

type FiltroPerfil = "todos" | "clube" | "agente" | "nao_cadastrado";
const TODAS_SITUACOES = Object.keys(ROTULO_SITUACAO_CLIENTE) as SituacaoCliente[];

function passaPerfil(c: ClienteLinha, filtro: FiltroPerfil) {
  if (filtro === "todos") return true;
  if (filtro === "nao_cadastrado") return c.tipo === null;
  return c.tipo === filtro;
}

function hrefCliente(c: ClienteLinha) {
  return c.clienteId ? `/clientes/${c.clienteId}` : `/clientes/bling/${c.blingContatoId}`;
}

export function ClientesTabela({ clientes }: { clientes: ClienteLinha[] }) {
  const [filtroPerfil, setFiltroPerfil] = useState<FiltroPerfil>("todos");
  const [situacoesSelecionadas, setSituacoesSelecionadas] = useState<SituacaoCliente[]>([]);

  function alternarSituacao(situacao: SituacaoCliente) {
    setSituacoesSelecionadas((atual) => (atual.includes(situacao) ? atual.filter((s) => s !== situacao) : [...atual, situacao]));
  }

  const passaSituacao = (c: ClienteLinha) => situacoesSelecionadas.length === 0 || situacoesSelecionadas.includes(c.situacao);
  const clientesFiltrados = useMemo(
    () => clientes.filter((c) => passaPerfil(c, filtroPerfil) && (situacoesSelecionadas.length === 0 || situacoesSelecionadas.includes(c.situacao))),
    [clientes, filtroPerfil, situacoesSelecionadas],
  );

  const opcoesPerfil = (
    [
      ["todos", "Todos"],
      ["clube", "Clubes"],
      ["agente", "Agentes"],
      ["nao_cadastrado", "Não cadastrados"],
    ] as const
  ).map(([valor, rotulo]) => ({ valor, rotulo, contagem: clientes.filter((c) => passaPerfil(c, valor) && passaSituacao(c)).length }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <AbasFiltro opcoes={opcoesPerfil} valor={filtroPerfil} onChange={setFiltroPerfil} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-[38px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all duration-200 focus-visible:shadow-focus focus-visible:outline-none",
              situacoesSelecionadas.length > 0
                ? "border-transparent bg-segment-active text-segment-active-foreground"
                : "border-lightBorder bg-surface text-dark hover:bg-surface-hover",
            )}
          >
            {situacoesSelecionadas.length === 0
              ? "Todas as situações"
              : situacoesSelecionadas.length === 1
                ? ROTULO_SITUACAO_CLIENTE[situacoesSelecionadas[0]]
                : `${situacoesSelecionadas.length} situações`}
            <MdExpandMore className="size-[18px] opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {TODAS_SITUACOES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={situacoesSelecionadas.includes(s)}
                onCheckedChange={() => alternarSituacao(s)}
                onSelect={(e) => e.preventDefault()}
              >
                {ROTULO_SITUACAO_CLIENTE[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ml-auto text-sm text-gray3">
          {clientesFiltrados.length} de {clientes.length} clientes
        </span>
      </div>

      {clientesFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdBusiness} titulo="Nenhum cliente com esses filtros" descricao="Ajuste o perfil ou a situação para ver os demais clientes." />
        </div>
      ) : (
        <Table minWidth={900}>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Parcelas emitidas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientesFiltrados.map((c) => {
              const situacao = c.cadastradoNoSistema ? STATUS_CLIENTE_VISUAL[c.situacao] : STATUS_CLIENTE_NAO_CADASTRADO;
              return (
                <LinhaClicavel key={c.blingContatoId} href={hrefCliente(c)}>
                  <TableCell className="max-w-[360px] whitespace-normal">
                    <div className="flex items-center gap-3">
                      <LogoCliente url={c.logoUrl} nome={c.razaoSocial} />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-bold text-purple-text">{c.nomeFantasia || c.razaoSocial}</span>
                        {c.nomeFantasia && <span className="text-xs text-gray3">{c.razaoSocial}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray2">{c.tipo === "clube" ? "Clube" : c.tipo === "agente" ? "Agente" : "—"}</TableCell>
                  <TableCell>{c.totalParcelas > 0 ? <BarraProgresso feito={c.parcelasEmitidas} total={c.totalParcelas} /> : <span className="text-gray3">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusPill tom={situacao.tom}>{situacao.rotulo}</StatusPill>
                      {c.situacao === "atrasado" && c.parcelasAtrasadas > 0 && (
                        <span className="text-xs text-red">
                          {c.parcelasAtrasadas} {c.parcelasAtrasadas === 1 ? "parcela" : "parcelas"} em atraso
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {c.clienteId ? (
                        <>
                          <Button variant="white" size="sm" nativeButton={false} render={<Link href={`/clientes/${c.clienteId}/editar`} />}>
                            <MdEdit className="size-4" />
                            Editar
                          </Button>
                          <ExcluirClienteDialog clienteId={c.clienteId} razaoSocial={c.razaoSocial} totalPedidos={c.totalPedidosLocais} />
                        </>
                      ) : (
                        <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/clientes/novo?blingContatoId=${c.blingContatoId}`} />}>
                          <MdPersonAdd className="size-4" />
                          Cadastrar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </LinhaClicavel>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

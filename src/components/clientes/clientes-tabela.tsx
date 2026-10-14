"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExcluirClienteDialog } from "@/components/clientes/excluir-cliente-dialog";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { ROTULO_SITUACAO_CLIENTE, VARIANTE_SITUACAO_CLIENTE, type SituacaoCliente } from "@/lib/clientes/situacao";
import type { TipoCliente } from "@/lib/supabase/database.types";

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

const TODOS = "todos";
const NAO_CADASTRADO = "nao_cadastrado";
const TODAS_SITUACOES = Object.keys(ROTULO_SITUACAO_CLIENTE) as SituacaoCliente[];

export function ClientesTabela({ clientes }: { clientes: ClienteLinha[] }) {
  const [filtroTipo, setFiltroTipo] = useState<string>(TODOS);
  const [situacoesSelecionadas, setSituacoesSelecionadas] = useState<SituacaoCliente[]>([]);

  function alternarSituacao(situacao: SituacaoCliente) {
    setSituacoesSelecionadas((atual) => (atual.includes(situacao) ? atual.filter((s) => s !== situacao) : [...atual, situacao]));
  }

  const clientesFiltrados = useMemo(
    () =>
      clientes.filter((c) => {
        const tipoOk = filtroTipo === TODOS || (filtroTipo === NAO_CADASTRADO ? c.tipo === null : c.tipo === filtroTipo);
        const situacaoOk = situacoesSelecionadas.length === 0 || situacoesSelecionadas.includes(c.situacao);
        return tipoOk && situacaoOk;
      }),
    [clientes, filtroTipo, situacoesSelecionadas],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v ?? TODOS)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os perfis</SelectItem>
            <SelectItem value="clube">Clube</SelectItem>
            <SelectItem value="agente">Agente</SelectItem>
            <SelectItem value={NAO_CADASTRADO}>Não cadastrado</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-52 items-center justify-between gap-2 rounded-lg border border-input bg-muted px-3 text-sm text-foreground hover:border-primary">
            {situacoesSelecionadas.length === 0
              ? "Todas as situações"
              : `${situacoesSelecionadas.length} situação(ões) selecionada(s)`}
            <ChevronDown className="size-4 text-muted-foreground" />
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

        <span className="text-sm text-muted-foreground">
          {clientesFiltrados.length} de {clientes.length}
        </span>
      </div>

      {clientesFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado com esses filtros.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Razão social</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Parcelas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientesFiltrados.map((c) => (
              <TableRow key={c.blingContatoId}>
                <TableCell>
                  <LogoCliente url={c.logoUrl} nome={c.razaoSocial} />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <Link
                    href={c.clienteId ? `/clientes/${c.clienteId}` : `/clientes/bling/${c.blingContatoId}`}
                    className="flex flex-col hover:underline"
                  >
                    {c.nomeFantasia && <span className="font-semibold">{c.nomeFantasia}</span>}
                    <span className={c.nomeFantasia ? "text-sm font-normal text-muted-foreground" : ""}>{c.razaoSocial}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  {c.tipo ? (
                    <Badge variant="outline" className="capitalize">
                      {c.tipo}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {c.totalParcelas > 0 ? `${c.parcelasEmitidas} de ${c.totalParcelas}` : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {c.cadastradoNoSistema ? (
                      <Badge variant={VARIANTE_SITUACAO_CLIENTE[c.situacao]}>{ROTULO_SITUACAO_CLIENTE[c.situacao]}</Badge>
                    ) : (
                      <Badge variant="neutral">Não cadastrado</Badge>
                    )}
                    {c.situacao === "atrasado" && c.parcelasAtrasadas > 0 && (
                      <span className="text-xs text-destructive">
                        {c.parcelasAtrasadas} parcela{c.parcelasAtrasadas > 1 ? "s" : ""} em atraso
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.clienteId ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/clientes/${c.clienteId}/editar`}>Editar</Link>}
                        />
                        <ExcluirClienteDialog clienteId={c.clienteId} razaoSocial={c.razaoSocial} totalPedidos={c.totalPedidosLocais} />
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/clientes/novo?blingContatoId=${c.blingContatoId}`}>Cadastrar</Link>}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

import Link from "next/link";
import { MdHistoryEdu } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { carregarHistoricoModelo } from "@/lib/contratos/historicoModelo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { DetalheAlteracaoModelo } from "@/components/contratos/detalhe-alteracao-modelo";

type Filtro = "todos" | "clube" | "agente";

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

// Jurídico · Histórico do modelo — alterações no modelo de contrato feitas a
// partir das versões editadas pelo jurídico (0041), mais recentes primeiro.
export default async function HistoricoModeloPage({ searchParams }: PageProps<"/juridico/historico">) {
  const { modelo } = await searchParams;
  const filtro: Filtro = modelo === "clube" || modelo === "agente" ? modelo : "todos";
  const supabase = await createClient();
  const { eventos, erro } = await carregarHistoricoModelo(supabase);
  const visiveis = filtro === "todos" ? eventos : eventos.filter((e) => e.perfil === filtro);
  const versaoAtual = (perfil: "clube" | "agente") => eventos.find((e) => e.perfil === perfil)?.versao ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Jurídico"
        titulo="Histórico do modelo"
        descricao="Alterações no modelo de contrato agregadas pelo jurídico a partir de versões editadas — cada uma gera uma nova versão do modelo."
        acoes={
          <span className="text-sm text-gray">
            Versão atual: Clube <strong className="font-bold text-darkPurple1">v{versaoAtual("clube")}</strong> · Agente{" "}
            <strong className="font-bold text-darkPurple1">v{versaoAtual("agente")}</strong>
          </span>
        }
      />

      <AbasFiltro
        valor={filtro}
        opcoes={[
          { valor: "todos", rotulo: "Todos", href: "/juridico/historico", contagem: eventos.length },
          { valor: "clube", rotulo: "Modelo Clube", href: "/juridico/historico?modelo=clube", contagem: eventos.filter((e) => e.perfil === "clube").length },
          { valor: "agente", rotulo: "Modelo Agente", href: "/juridico/historico?modelo=agente", contagem: eventos.filter((e) => e.perfil === "agente").length },
        ]}
      />

      {erro ? (
        <p className="rounded-xl border border-red/30 bg-dangerBg px-5 py-4 text-sm text-red">Não foi possível carregar o histórico: {erro}</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio
            icone={MdHistoryEdu}
            titulo="Nenhuma alteração no modelo ainda"
            descricao="Quando o jurídico agregar ao modelo uma mudança de uma versão editada, ela aparece aqui. Até lá, os contratos usam o modelo padrão (v1)."
          />
        </div>
      ) : (
        <Table minWidth={1000}>
          <TableHeader>
            <TableRow>
              <TableHead>Versão</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Alteração</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((e) => (
              <TableRow key={e.chave}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-darkPurple1">v{e.versao}</span>
                    <span className="text-xs text-gray3">Modelo {e.perfil === "clube" ? "Clube" : "Agente"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray2">{formatarDataHora(e.data)}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal">
                  <div className="flex flex-col gap-1">
                    <BadgeTom tom={e.tipo === "agregado" ? "active" : "inactive"}>{e.tipo === "agregado" ? "Trecho agregado" : "Ajuste desativado"}</BadgeTom>
                    <span className="line-clamp-2 text-xs text-gray2">{e.resumo ?? e.clausula ?? e.trechoNovo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray2">{e.usuario ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal">
                  {e.origem ? (
                    <Link href={`/pedidos/${e.origem.pedidoId}`} className="font-semibold text-purple-text hover:underline">
                      {e.origem.cliente}
                      <span className="block text-xs font-normal text-gray3">contrato v{e.origem.versaoContrato}</span>
                    </Link>
                  ) : (
                    <span className="text-gray3">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {e.tipo === "agregado" ? (
                    <StatusPill tom={e.ativo ? "active" : "not_started"}>{e.ativo ? "Ativo" : "Desativado"}</StatusPill>
                  ) : (
                    <span className="text-xs text-gray3">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DetalheAlteracaoModelo evento={e} />
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

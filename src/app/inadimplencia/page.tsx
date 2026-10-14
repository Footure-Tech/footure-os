import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarClientesInadimplentes } from "@/lib/inadimplencia/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogoCliente } from "@/components/clientes/logo-cliente";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Vencimento vem como "aaaa-mm-dd" — divide a string em vez de usar Date
 * pra não sofrer o deslocamento de fuso horário do parse UTC-meia-noite. */
function formatarDataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function InadimplenciaPage() {
  const supabase = await createClient();
  const clientes = await listarClientesInadimplentes(supabase);

  const todasParcelas = clientes.flatMap((c) => c.parcelas);
  const totalGeral = todasParcelas.reduce((soma, p) => soma + p.valor, 0);
  // "até 30 dias" inclui o 30º dia; "mais de 30" começa no 31º.
  const totalAte30Dias = todasParcelas.filter((p) => p.diasAtraso <= 30).reduce((soma, p) => soma + p.valor, 0);
  const totalMais30Dias = todasParcelas.filter((p) => p.diasAtraso > 30).reduce((soma, p) => soma + p.valor, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Inadimplência</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total em atraso</CardDescription>
            <CardTitle className="text-2xl">{formatarMoeda(totalGeral)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Atrasado até 30 dias</CardDescription>
            <CardTitle className="text-2xl">{formatarMoeda(totalAte30Dias)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Atrasado há mais de 30 dias</CardDescription>
            <CardTitle className="text-2xl">{formatarMoeda(totalMais30Dias)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente com parcela em atraso no momento.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {clientes.map((c, indice) => (
            // O primeiro (maior total em atraso, lista já vem ordenada assim)
            // começa expandido; os demais ficam recolhidos.
            <details key={c.blingContatoId} className="group rounded-lg border border-border" open={indice === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 select-none">
                <Link
                  href={c.clienteId ? `/clientes/${c.clienteId}` : `/clientes/bling/${c.blingContatoId}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <LogoCliente url={urlLogoCliente(supabase, c.logoPath)} nome={c.razaoSocial} />
                  <div className="flex flex-col">
                    {c.nomeFantasia && <span className="font-semibold">{c.nomeFantasia}</span>}
                    <span className={c.nomeFantasia ? "text-sm font-normal text-muted-foreground" : "font-semibold"}>
                      {c.razaoSocial}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Parcelas em atraso</p>
                    <p className="text-sm font-medium">{c.parcelas.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total em atraso</p>
                    <p className="text-sm font-medium text-destructive">{formatarMoeda(c.totalAtrasado)}</p>
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="border-t border-border px-4 py-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Dias em atraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.parcelas.map((p) => (
                      <TableRow key={`${p.numeroPedido}-${p.numeroParcela}`}>
                        <TableCell>{p.numeroParcela}</TableCell>
                        <TableCell>{formatarDataBr(p.vencimento)}</TableCell>
                        <TableCell>{formatarMoeda(p.valor)}</TableCell>
                        <TableCell>{p.diasAtraso}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

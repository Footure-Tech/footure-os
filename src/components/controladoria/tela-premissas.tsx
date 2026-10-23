import { MdAccountTree } from "react-icons/md";
import type { carregarTelaPremissas } from "@/lib/controladoria/consultas";
import { CAMADAS_CAIXA, DESCRICAO_CAMADA, ROTULO_CAMADA } from "@/lib/controladoria/modelo";
import type { CamadaContaFinanceira } from "@/lib/supabase/database.types";
import { PageHeader } from "@/components/shell/page-header";
import { CardModulo } from "@/components/negocio/card-modulo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormPremissas, FormSaldos, SeletorCamada } from "./acoes";

type Dados = Awaited<ReturnType<typeof carregarTelaPremissas>>;

const COM_SALDO: CamadaContaFinanceira[] = [...CAMADAS_CAIXA, "aplicacao", "gateway"];

// Controladoria · Premissas (spec §3): saldos das contas, camadas do caixa e limites dos alertas.
export function TelaPremissas({ dados }: { dados: Dados }) {
  const { contas, premissas, hoje } = dados;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader modulo="Controladoria" titulo="Premissas" descricao="Saldos das contas, como cada conta entra no caixa e os limites que disparam os alertas." />

      <FormSaldos contas={contas.filter((c) => COM_SALDO.includes(c.camada))} hoje={hoje} />

      <CardModulo icone={MdAccountTree} cor="bg-iconBlue" titulo="Contas financeiras do Bling">
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-6 gap-y-1.5 text-xs text-gray2">
          {(Object.keys(ROTULO_CAMADA) as CamadaContaFinanceira[]).map((k) => (
            <li key={k}>
              <strong className="font-semibold text-darkPurple1">{ROTULO_CAMADA[k]}:</strong> {DESCRICAO_CAMADA[k]}
            </li>
          ))}
        </ul>
        <Table minWidth={720}>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Lançamentos (90 dias)</TableHead>
              <TableHead>Camada no caixa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold text-darkPurple1">{c.descricao || <span className="text-gray3">(sem nome)</span>}</TableCell>
                <TableCell className="text-right text-gray2">{c.usoRecente || "—"}</TableCell>
                <TableCell>
                  <SeletorCamada id={c.id} camada={c.camada} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardModulo>

      <FormPremissas premissas={premissas} />
    </div>
  );
}

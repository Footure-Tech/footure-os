"use client";

import { useActionState, useState, type FocusEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlocoFormulario } from "@/components/pedido/bloco-formulario";
import { LogoCliente } from "@/components/clientes/logo-cliente";
import { salvarDadosContratoBlingAction, type EstadoDadosContrato } from "@/lib/financeiro/serverActions";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { ROTULO_ORIGEM_VENDA, ROTULO_TIPO_VENDA } from "@/lib/vendas/rotulos";
import type { OrigemVenda, TipoVenda } from "@/lib/supabase/database.types";

const NENHUM = "nenhum";
const ESTADO_INICIAL: EstadoDadosContrato = {};
const selecionar = (e: FocusEvent<HTMLInputElement>) => e.target.select();

export interface DadosContratoForm {
  blingPedidoId: number;
  numeroPedido: string;
  cliente: string;
  logoUrl: string | null;
  valorTotal: number;
  dataVenda: string | null;
  /** Vigência salva ou, sem ela, a estimada (sugestão). */
  inicio: string | null;
  fim: string | null;
  vigenciaDefinida: boolean;
  sdrId: string | null;
  closerId: string | null;
  tipoVenda: TipoVenda | null;
  origem: OrigemVenda | null;
  licencasPagas: number | null;
  licencasGratuitas: number | null;
  valorLicencaAdicional: number | null;
}

// Tela única para os dados que o Bling não tem: vigência, SDR/Closer e licenças.
export function FormDadosContrato({ dados, usuarios }: { dados: DadosContratoForm; usuarios: { id: string; nome: string }[] }) {
  const [estado, formAction, pendente] = useActionState(salvarDadosContratoBlingAction, ESTADO_INICIAL);
  const [sdr, setSdr] = useState(dados.sdrId ?? NENHUM);
  const [closer, setCloser] = useState(dados.closerId ?? NENHUM);
  const [tipoVenda, setTipoVenda] = useState<string>(dados.tipoVenda ?? NENHUM);
  const [origem, setOrigem] = useState<string>(dados.origem ?? NENHUM);
  // Sem vigência definida, os campos começam vazios (salvar só SDR/licenças não
  // pode gravar a estimativa como vigência oficial sem querer).
  const [inicio, setInicio] = useState(dados.vigenciaDefinida ? (dados.inicio ?? "") : "");
  const [fim, setFim] = useState(dados.vigenciaDefinida ? (dados.fim ?? "") : "");
  const voltar = `/financeiro/contratos/${dados.blingPedidoId}`;

  const seletor = (id: string, rotulo: string, valor: string, aoMudar: (v: string) => void, opcoes: Record<string, string>) => (
    <div className="flex flex-col gap-2">
      <Label variante="campo" htmlFor={id}>
        {rotulo}
      </Label>
      <Select items={{ [NENHUM]: "Não informado", ...opcoes }} value={valor} onValueChange={(v) => v && aoMudar(v as string)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM}>Não informado</SelectItem>
          {Object.entries(opcoes).map(([valorOpcao, rotuloOpcao]) => (
            <SelectItem key={valorOpcao} value={valorOpcao}>
              {rotuloOpcao}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const pessoas = Object.fromEntries(usuarios.map((u) => [u.id, u.nome]));

  return (
    <form action={formAction} className="grid grid-cols-1 items-start gap-5 pb-16 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <input type="hidden" name="blingPedidoId" value={dados.blingPedidoId} />
      <input type="hidden" name="sdr" value={sdr === NENHUM ? "" : sdr} />
      <input type="hidden" name="closer" value={closer === NENHUM ? "" : closer} />
      <input type="hidden" name="tipoVenda" value={tipoVenda === NENHUM ? "" : tipoVenda} />
      <input type="hidden" name="origem" value={origem === NENHUM ? "" : origem} />

      <div className="flex flex-col gap-5">
        {estado.erro && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{estado.erro}</p>}

        <BlocoFormulario
          titulo="Vigência"
          descricao="Início e fim do contrato. Com a vigência em curso, o contrato conta como ativo — mesmo pago à vista."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="vigencia-inicio">
                Início
              </Label>
              <Input id="vigencia-inicio" type="date" name="inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="vigencia-fim">
                Fim
              </Label>
              <Input id="vigencia-fim" type="date" name="fim" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
          {!dados.vigenciaDefinida && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">
              <span className="min-w-0 flex-1">
                Vigência ainda não definida.
                {dados.inicio && dados.fim
                  ? ` Estimativa pelo Bling: ${formatarDataCurta(dados.inicio)} a ${formatarDataCurta(dados.fim)} (data da venda até o último vencimento).`
                  : ""}{" "}
                Em branco, nada muda.
              </span>
              {dados.inicio && dados.fim && !inicio && !fim && (
                <Button
                  type="button"
                  variant="white"
                  size="sm"
                  onClick={() => {
                    setInicio(dados.inicio ?? "");
                    setFim(dados.fim ?? "");
                  }}
                >
                  Usar estimativa
                </Button>
              )}
            </div>
          )}
        </BlocoFormulario>

        <BlocoFormulario titulo="Dados comerciais" descricao="Tipo e origem da venda e quem participou dela (SDR e Closer podem ser a mesma pessoa).">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {seletor("venda-tipo", "Tipo de venda", tipoVenda, setTipoVenda, ROTULO_TIPO_VENDA)}
            {seletor("venda-origem", "Origem", origem, setOrigem, ROTULO_ORIGEM_VENDA)}
            {seletor("equipe-sdr", "SDR", sdr, setSdr, pessoas)}
            {seletor("equipe-closer", "Closer", closer, setCloser, pessoas)}
          </div>
        </BlocoFormulario>

        <BlocoFormulario titulo="Licenças" descricao="Mesmos campos do pedido de venda da plataforma. Deixe em branco se ainda não souber.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="licencas-pagas">
                Licenças pagas
              </Label>
              <Input id="licencas-pagas" name="licencasPagas" type="text" inputMode="numeric" defaultValue={dados.licencasPagas ?? ""} onFocus={selecionar} />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="licencas-gratuitas">
                Licenças gratuitas
              </Label>
              <Input
                id="licencas-gratuitas"
                name="licencasGratuitas"
                type="text"
                inputMode="numeric"
                defaultValue={dados.licencasGratuitas ?? ""}
                onFocus={selecionar}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="licenca-adicional">
                Licença adicional (R$)
              </Label>
              <Input
                id="licenca-adicional"
                name="valorLicencaAdicional"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={dados.valorLicencaAdicional === null ? "" : dados.valorLicencaAdicional.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                onFocus={selecionar}
              />
            </div>
          </div>
        </BlocoFormulario>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card lg:sticky lg:top-[90px]">
        <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Resumo do contrato</span>
        <div className="flex items-center gap-3">
          <LogoCliente url={dados.logoUrl} nome={dados.cliente} tamanho="md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xl font-bold text-darkPurple1">{dados.cliente}</span>
            <span className="text-sm text-gray">Pedido Bling nº {dados.numeroPedido}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 border-y border-gray5 py-4 text-sm">
          <div className="flex items-baseline gap-3">
            <span className="flex-1 text-gray">Valor total</span>
            <span className="font-bold text-darkPurple1">{formatarMoeda(dados.valorTotal)}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="flex-1 text-gray">Data da venda</span>
            <span className="font-semibold text-darkPurple1">{dados.dataVenda ? formatarDataCurta(dados.dataVenda) : "—"}</span>
          </div>
          <p className="text-xs text-gray3">Esses dados não existem no Bling — ficam registrados só na plataforma.</p>
        </div>
        <Button type="submit" disabled={pendente} className="w-full">
          {pendente ? "Salvando…" : "Salvar dados do contrato"}
        </Button>
        <Button type="button" variant="white" className="w-full" nativeButton={false} render={<Link href={voltar} />}>
          Cancelar
        </Button>
      </aside>
    </form>
  );
}

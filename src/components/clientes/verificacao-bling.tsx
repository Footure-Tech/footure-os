"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarCnpj, formatarEnderecoCliente } from "@/lib/clientes/formatacao";
import { verificarCnpjAction, type ResultadoVerificacaoCnpj } from "@/lib/clientes/serverActions";
import type { ContatoBlingEncontrado, DadosEmpresa, DecisaoBling } from "@/lib/clientes/vinculoBling";

/** Consulta o CNPJ no Bling (e na base local) ao sair do campo — só quando muda e tem 11/14 dígitos. */
export function useVerificacaoCnpj(ignorarClienteId?: string) {
  const [resultado, setResultado] = useState<ResultadoVerificacaoCnpj | null>(null);
  const [verificando, setVerificando] = useState(false);
  const ultimo = useRef("");

  async function verificar(dados: DadosEmpresa) {
    const documento = dados.cnpj.replace(/\D/g, "");
    if (documento === ultimo.current) return;
    ultimo.current = documento;
    if (documento.length !== 11 && documento.length !== 14) {
      setResultado(null);
      return;
    }
    setVerificando(true);
    try {
      setResultado(await verificarCnpjAction(dados, ignorarClienteId));
    } finally {
      setVerificando(false);
    }
  }

  return { resultado, verificando, verificar };
}

export function AvisoCnpjBling({
  resultado,
  verificando,
  aoPreencherComBling,
  aoUsarClienteExistente,
}: {
  resultado: ResultadoVerificacaoCnpj | null;
  verificando: boolean;
  aoPreencherComBling: (dados: DadosEmpresa) => void;
  /** No pedido: troca o cadastro rápido pelo cliente que já existe. */
  aoUsarClienteExistente?: (clienteId: string) => void;
}) {
  if (verificando) return <p className="text-xs text-gray3">Verificando o CNPJ no Bling…</p>;
  if (!resultado) return null;
  if (resultado.erro) {
    // CNPJ/CPF inválido ou falha ao consultar o Bling — a mensagem já diz qual.
    return <p className="rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">{resultado.erro}</p>;
  }

  if (resultado.clienteLocal) {
    const { id, nome } = resultado.clienteLocal;
    return (
      <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <span>
          Já existe um cliente com este CNPJ no sistema: <strong>{nome}</strong>.
        </span>
        {aoUsarClienteExistente ? (
          <Button type="button" variant="white" className="self-start" onClick={() => aoUsarClienteExistente(id)}>
            Usar este cliente
          </Button>
        ) : (
          <a href={`/clientes/${id}`} className="self-start font-semibold underline">
            Abrir o cadastro existente
          </a>
        )}
      </div>
    );
  }

  const contato = resultado.contatoBling;
  if (!contato) {
    return <p className="text-xs text-gray3">CNPJ não encontrado no Bling — o contato será cadastrado lá ao salvar.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-page px-4 py-3 text-sm">
      <span className="font-semibold text-darkPurple1">Este CNPJ já está cadastrado no Bling</span>
      <DadosBling dados={contato.dados} />
      <p className="text-xs text-gray3">Ao salvar, o cliente é vinculado a esse contato. Se os dados informados forem diferentes, você escolhe qual versão vale.</p>
      <Button type="button" variant="white" className="self-start" onClick={() => aoPreencherComBling(contato.dados)}>
        Preencher com os dados do Bling
      </Button>
    </div>
  );
}

function DadosBling({ dados }: { dados: DadosEmpresa }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt className="text-gray3">Razão social</dt>
      <dd className="text-darkPurple1">{dados.razaoSocial || "—"}</dd>
      <dt className="text-gray3">Nome fantasia</dt>
      <dd className="text-darkPurple1">{dados.nomeFantasia || "—"}</dd>
      <dt className="text-gray3">CNPJ</dt>
      <dd className="text-darkPurple1">{formatarCnpj(dados.cnpj)}</dd>
      <dt className="text-gray3">Endereço</dt>
      <dd className="text-darkPurple1">{formatarEnderecoCliente(dados) || "—"}</dd>
    </dl>
  );
}

/** Divergência no envio: o que foi informado × o que está no Bling, campo a campo. */
export function DivergenciaBlingDialog({
  divergencia,
  aoDecidir,
  aoCancelar,
  pendente,
}: {
  divergencia: ContatoBlingEncontrado | null;
  aoDecidir: (decisao: DecisaoBling) => void;
  aoCancelar: () => void;
  pendente?: boolean;
}) {
  return (
    <Dialog open={!!divergencia} onOpenChange={(aberto) => !aberto && aoCancelar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cliente já cadastrado no Bling</DialogTitle>
          <DialogDescription>
            Este CNPJ já existe no Bling, mas alguns dados são diferentes dos informados. Atualizar os dados da empresa no Bling com o que você
            informou?
          </DialogDescription>
        </DialogHeader>
        {divergencia && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
                  <th className="py-2 pr-3">Campo</th>
                  <th className="py-2 pr-3">Informado</th>
                  <th className="py-2">No Bling</th>
                </tr>
              </thead>
              <tbody>
                {divergencia.divergencias.map((d) => (
                  <tr key={d.campo} className="border-t border-gray5 align-top">
                    <td className="py-2 pr-3 text-gray3">{d.rotulo}</td>
                    <td className="py-2 pr-3 font-semibold text-darkPurple1">{d.informado || "—"}</td>
                    <td className="py-2 text-darkPurple1">{d.bling || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="white" disabled={pendente} onClick={() => aoDecidir("usar_bling")}>
            Não, manter os dados do Bling
          </Button>
          <Button type="button" disabled={pendente} onClick={() => aoDecidir("atualizar_bling")}>
            Sim, atualizar o Bling
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

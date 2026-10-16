"use client";

import { useState, useTransition, type FocusEvent } from "react";
import { toast } from "sonner";
import { MdEdit, MdPlaylistAdd } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { salvarLicencasContratoBlingAction } from "@/lib/financeiro/serverActions";

/** "1.234,56" / "1234.56" / "120" → número; vazio → null. */
function paraValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

function formatarValor(n: number | null) {
  return n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const selecionar = (e: FocusEvent<HTMLInputElement>) => e.target.select();

// Licenças de uma venda que veio do Bling (o Bling não tem esse dado) — mesmos
// campos do pedido da plataforma: pagas, gratuitas e valor da licença adicional.
export function EditarLicencasDialog({
  blingPedidoId,
  licencasPagas,
  licencasGratuitas,
  valorLicencaAdicional,
}: {
  blingPedidoId: number;
  licencasPagas: number | null;
  licencasGratuitas: number | null;
  valorLicencaAdicional: number | null;
}) {
  const definida = licencasPagas !== null;
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pagas, setPagas] = useState(String(licencasPagas ?? 1));
  const [gratuitas, setGratuitas] = useState(String(licencasGratuitas ?? 0));
  const [adicional, setAdicional] = useState(formatarValor(valorLicencaAdicional));

  function salvar() {
    setErro(null);
    const nPagas = Number(pagas.trim() || "0");
    const nGratuitas = Number(gratuitas.trim() || "0");
    const valor = paraValor(adicional);
    if (!Number.isInteger(nPagas) || !Number.isInteger(nGratuitas) || nPagas < 0 || nGratuitas < 0) {
      setErro("Informe o número de licenças como um número inteiro.");
      return;
    }
    if (valor !== null && Number.isNaN(valor)) {
      setErro("Valor da licença adicional inválido — use o formato 1.234,56.");
      return;
    }
    iniciar(async () => {
      const resultado = await salvarLicencasContratoBlingAction(blingPedidoId, nPagas, nGratuitas, valor);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Licenças salvas");
      setAberto(false);
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          setPagas(String(licencasPagas ?? 1));
          setGratuitas(String(licencasGratuitas ?? 0));
          setAdicional(formatarValor(valorLicencaAdicional));
          setErro(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant={definida ? "white" : "secondary"} size="sm" />}>
        {definida ? <MdEdit className="size-4" /> : <MdPlaylistAdd className="size-4" />}
        {definida ? "Editar licenças" : "Definir licenças"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Licenças do contrato</DialogTitle>
          <DialogDescription>O Bling não guarda as licenças contratadas — o registro fica aqui, com os mesmos campos do pedido de venda da plataforma.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div className="flex flex-col gap-2">
            <Label variante="campo" htmlFor="licencas-pagas">
              Licenças pagas
            </Label>
            <Input id="licencas-pagas" type="text" inputMode="numeric" value={pagas} onChange={(e) => setPagas(e.target.value)} onFocus={selecionar} />
          </div>
          <div className="flex flex-col gap-2">
            <Label variante="campo" htmlFor="licencas-gratuitas">
              Licenças gratuitas
            </Label>
            <Input id="licencas-gratuitas" type="text" inputMode="numeric" value={gratuitas} onChange={(e) => setGratuitas(e.target.value)} onFocus={selecionar} />
          </div>
          <div className="flex flex-col gap-2">
            <Label variante="campo" htmlFor="licenca-adicional">
              Licença adicional (R$)
            </Label>
            <Input
              id="licenca-adicional"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={adicional}
              onChange={(e) => setAdicional(e.target.value)}
              onFocus={selecionar}
            />
          </div>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pendente} onClick={salvar}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

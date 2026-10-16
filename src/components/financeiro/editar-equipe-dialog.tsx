"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MdEdit, MdGroupAdd } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { salvarEquipeContratoBlingAction } from "@/lib/financeiro/serverActions";

const NENHUM = "nenhum";

// SDR e Closer de uma venda que veio do Bling (o Bling não tem esse dado).
export function EditarEquipeDialog({
  blingPedidoId,
  sdrId,
  closerId,
  usuarios,
}: {
  blingPedidoId: number;
  sdrId: string | null;
  closerId: string | null;
  usuarios: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sdr, setSdr] = useState(sdrId ?? NENHUM);
  const [closer, setCloser] = useState(closerId ?? NENHUM);
  const definida = !!(sdrId || closerId);
  const rotulos: Record<string, string> = { [NENHUM]: "Não informado", ...Object.fromEntries(usuarios.map((u) => [u.id, u.nome])) };

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await salvarEquipeContratoBlingAction(blingPedidoId, sdr === NENHUM ? null : sdr, closer === NENHUM ? null : closer);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      toast.success("SDR e Closer salvos");
      setAberto(false);
    });
  }

  const seletor = (id: string, rotulo: string, valor: string, aoMudar: (v: string) => void) => (
    <div className="flex flex-col gap-2">
      <Label variante="campo" htmlFor={id}>
        {rotulo}
      </Label>
      <Select items={rotulos} value={valor} onValueChange={(v) => v && aoMudar(v as string)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM}>Não informado</SelectItem>
          {usuarios.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          setSdr(sdrId ?? NENHUM);
          setCloser(closerId ?? NENHUM);
          setErro(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant={definida ? "white" : "secondary"} size="sm" />}>
        {definida ? <MdEdit className="size-4" /> : <MdGroupAdd className="size-4" />}
        {definida ? "Editar SDR e Closer" : "Definir SDR e Closer"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SDR e Closer da venda</DialogTitle>
          <DialogDescription>O Bling não guarda quem participou da venda — o registro fica aqui e aparece na tela Vendas. Podem ser a mesma pessoa.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {seletor("equipe-sdr", "SDR", sdr, setSdr)}
          {seletor("equipe-closer", "Closer", closer, setCloser)}
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

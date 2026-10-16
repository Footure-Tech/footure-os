"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MdEdit, MdEventAvailable } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { salvarVigenciaContratoBlingAction } from "@/lib/financeiro/serverActions";

// Vigência de um contrato que veio do Bling (o Bling não tem esse dado). Sem
// vigência definida, os campos já vêm sugeridos: data da venda e vencimento
// da última parcela — o que a tela usava até então.
export function EditarVigenciaDialog({
  blingPedidoId,
  inicio,
  fim,
  definida,
}: {
  blingPedidoId: number;
  inicio: string | null;
  fim: string | null;
  definida: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar(formData: FormData) {
    const novoInicio = String(formData.get("inicio") ?? "");
    const novoFim = String(formData.get("fim") ?? "");
    setErro(null);
    iniciar(async () => {
      const resultado = await salvarVigenciaContratoBlingAction(blingPedidoId, novoInicio, novoFim);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Vigência do contrato salva");
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant={definida ? "white" : "secondary"} size="sm" />}>
        {definida ? <MdEdit className="size-4" /> : <MdEventAvailable className="size-4" />}
        {definida ? "Editar vigência" : "Definir vigência"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vigência do contrato</DialogTitle>
          <DialogDescription>
            O Bling não guarda a vigência — ela é controlada aqui. Enquanto a vigência estiver em curso, o contrato conta como ativo, mesmo com todas as
            parcelas pagas.
          </DialogDescription>
        </DialogHeader>
        <form action={salvar} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="vigencia-inicio">
                Início
              </Label>
              <Input id="vigencia-inicio" type="date" name="inicio" defaultValue={inicio ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label variante="campo" htmlFor="vigencia-fim">
                Fim
              </Label>
              <Input id="vigencia-fim" type="date" name="fim" defaultValue={fim ?? ""} required />
            </div>
          </div>
          {!definida && <p className="text-xs text-gray3">Sugestão: data da venda e vencimento da última parcela. Ajuste para as datas do contrato.</p>}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar vigência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

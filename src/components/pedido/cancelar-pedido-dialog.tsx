"use client";

import { exigirSucesso } from "@/lib/resultadoAcao";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdBlock } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelarPedidoAction } from "@/lib/pedidos/serverActions";
import { MOTIVOS_CANCELAMENTO } from "@/lib/pedidos/motivosCancelamento";

// Disponível na listagem de pedidos e na tela de detalhe/edição — mesmo
// diálogo e mesmo gatilho visual nos dois lugares.
export function CancelarPedidoDialog({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const precisaObservacao = motivo === "Outro";
  const podeConfirmar = !!motivo && (!precisaObservacao || observacao.trim().length > 0);

  function confirmar() {
    iniciar(async () => {
      try {
        exigirSucesso(await cancelarPedidoAction(pedidoId, motivo, observacao || undefined));
        toast.success("Pedido cancelado.");
        setAberto(false);
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao cancelar o pedido.");
      }
    });
  }

  function aoFechar(open: boolean) {
    setAberto(open);
    if (!open) {
      setMotivo("");
      setObservacao("");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={aoFechar}>
      <DialogTrigger render={<Button type="button" variant="white" className="text-red" />}>
        <MdBlock className="size-4" />
        Cancelar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>
            Essa ação encerra o pedido de venda — não é possível reverter. Selecione o motivo do cancelamento.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Motivo do cancelamento</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_CANCELAMENTO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Observação{precisaObservacao ? " (obrigatória)" : " (opcional)"}</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Voltar</DialogClose>
          <Button type="button" variant="destructive" disabled={pendente || !podeConfirmar} onClick={confirmar}>
            {pendente ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

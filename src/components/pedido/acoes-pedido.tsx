"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { UploadNovaVersao } from "@/components/pedido/upload-nova-versao";
import {
  aprovarPedidoAction,
  reprovarPedidoAction,
  tentarGerarNovamenteAction,
  liberarParaAssinaturaAction,
  rejeitarContratoAction,
  enviarParaAssinaturaAction,
  enviarParaAprovacaoAction,
  cancelarAssinaturaAction,
} from "@/lib/pedidos/serverActions";
import type { PapelUsuario, StatusPedido } from "@/lib/supabase/database.types";

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  function rodar(acao: () => Promise<void>, msgSucesso: string) {
    iniciar(async () => {
      try {
        await acao();
        toast.success(msgSucesso);
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao executar a ação.");
      }
    });
  }
  return { pendente, rodar };
}

function ComComentario({
  rotuloBotao,
  titulo,
  descricao,
  placeholder,
  variant,
  onConfirmar,
}: {
  rotuloBotao: string;
  titulo: string;
  descricao: string;
  placeholder: string;
  variant?: "destructive" | "white";
  onConfirmar: (comentario: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [comentario, setComentario] = useState("");

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant={variant} />}>{rotuloBotao}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <Textarea placeholder={placeholder} value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Voltar</DialogClose>
          <Button
            type="button"
            variant={variant}
            disabled={!comentario.trim()}
            onClick={() => {
              onConfirmar(comentario);
              setAberto(false);
              setComentario("");
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Status em que a próxima ação é sobre o CONTRATO (renderizadas dentro do
// card do contrato na tela Negócio); as demais são sobre o pedido (cabeçalho).
const STATUS_ACAO_CONTRATO: StatusPedido[] = ["aprovado", "em_revisao_juridica", "pronto_para_assinatura", "enviado_para_assinatura"];

export function AcoesPedido({
  pedidoId,
  status,
  papel,
  donoDoRascunho,
  escopo,
}: {
  pedidoId: string;
  status: StatusPedido;
  papel: PapelUsuario;
  donoDoRascunho: boolean;
  escopo: "pedido" | "contrato";
}) {
  const { pendente, rodar } = useAcao();

  if (STATUS_ACAO_CONTRATO.includes(status) !== (escopo === "contrato")) return null;

  if (status === "rascunho" && donoDoRascunho) {
    return (
      <Button disabled={pendente} onClick={() => rodar(() => enviarParaAprovacaoAction(pedidoId), "Pedido enviado para aprovação")}>
        Enviar para aprovação
      </Button>
    );
  }

  if (status === "em_aprovacao" && papel === "admin") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={pendente} onClick={() => rodar(() => aprovarPedidoAction(pedidoId), "Pedido aprovado · contrato em geração")}>
          Aprovar
        </Button>
        <ComComentario
          rotuloBotao="Reprovar"
          titulo="Reprovar pedido"
          descricao="O pedido volta para rascunho e o vendedor vê o motivo no histórico."
          placeholder="Motivo da reprovação (obrigatório)"
          variant="destructive"
          onConfirmar={(c) => rodar(() => reprovarPedidoAction(pedidoId, c), "Pedido reprovado")}
        />
      </div>
    );
  }

  if (status === "aprovado" && (papel === "admin" || papel === "juridico")) {
    return (
      <AcoesContrato
        primaria={
          <Button disabled={pendente} onClick={() => rodar(() => tentarGerarNovamenteAction(pedidoId), "Gerando o contrato novamente")}>
            Tentar gerar contrato novamente
          </Button>
        }
      />
    );
  }

  if (status === "em_revisao_juridica" && (papel === "juridico" || papel === "admin")) {
    return (
      <AcoesContrato
        primaria={
          <Button
            disabled={pendente}
            onClick={() => rodar(() => liberarParaAssinaturaAction(pedidoId), "Contrato liberado para assinatura")}
          >
            Liberar para assinatura
          </Button>
        }
        secundarias={
          <>
            <RegenerarContratoDialog pedidoId={pedidoId} />
            <SubirNovaVersaoDialog pedidoId={pedidoId} />
          </>
        }
      />
    );
  }

  if (status === "pronto_para_assinatura" && (papel === "juridico" || papel === "admin")) {
    return (
      <AcoesContrato
        primaria={
          <Button
            disabled={pendente}
            onClick={() => rodar(() => enviarParaAssinaturaAction(pedidoId), "Contrato enviado para assinatura via Clicksign")}
          >
            Enviar para assinatura
          </Button>
        }
        secundarias={<CancelarAssinaturaDialog pedidoId={pedidoId} />}
      />
    );
  }

  if (status === "enviado_para_assinatura" && (papel === "juridico" || papel === "admin")) {
    return <AcoesContrato secundarias={<CancelarAssinaturaDialog pedidoId={pedidoId} />} />;
  }

  return null;
}

// Layout das ações dentro do card do contrato: todas numa linha, dividindo a
// largura em partes iguais, com a primária por último (à direita) — mesmo
// padrão dos rodapés de modal do sistema. Quebram em telas estreitas.
function AcoesContrato({ primaria, secundarias }: { primaria?: ReactNode; secundarias?: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2.5 *:min-w-[160px] *:flex-1">
      {secundarias}
      {primaria}
    </div>
  );
}

function CancelarAssinaturaDialog({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [comentario, setComentario] = useState("");
  const { pendente, rodar } = useAcao();

  function confirmar() {
    rodar(async () => {
      await cancelarAssinaturaAction(pedidoId, comentario || undefined);
      setAberto(false);
      setComentario("");
    }, "Assinatura cancelada · contrato voltou para validação");
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="white" />}>Cancelar assinatura</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar processo de assinatura</DialogTitle>
          <DialogDescription>
            O pedido volta para &quot;em revisão jurídica&quot; e passa a poder ser editado pelo vendedor de novo.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo do cancelamento (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Voltar</DialogClose>
          <Button type="button" variant="destructive" disabled={pendente} onClick={confirmar}>
            {pendente ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegenerarContratoDialog({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [comentario, setComentario] = useState("");
  const { pendente, rodar } = useAcao();

  function confirmar() {
    rodar(async () => {
      await rejeitarContratoAction(pedidoId, comentario);
      setAberto(false);
      setComentario("");
    }, "Contrato em regeneração");
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="white" />}>Regenerar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerar contrato</DialogTitle>
          <DialogDescription>
            O pedido volta para &quot;aprovado&quot; e o contrato é gerado novamente. Descreva o que precisa mudar.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="O que precisa mudar? (obrigatório)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Cancelar</DialogClose>
          <Button type="button" disabled={pendente || !comentario.trim()} onClick={confirmar}>
            {pendente ? "Enviando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubirNovaVersaoDialog({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="white" />}>Subir nova versão</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir nova versão do contrato</DialogTitle>
          <DialogDescription>Envie o .docx editado manualmente — vira a versão mais recente do contrato.</DialogDescription>
        </DialogHeader>
        <UploadNovaVersao
          pedidoId={pedidoId}
          onSucesso={() => {
            setAberto(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

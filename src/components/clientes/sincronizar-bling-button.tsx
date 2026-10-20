"use client";

import { exigirSucesso } from "@/lib/resultadoAcao";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MdSync } from "react-icons/md";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sincronizarContatosBlingAction } from "@/lib/clientes/serverActions";
import { cn } from "@/lib/utils";

// Sincronização sob demanda com o Bling (contatos + parcelas em cache). Além
// dela, o cron roda às 7h, 12h e 18h (/api/cron/bling); `emAndamento` = a
// última execução registrada ainda está rodando (o servidor recusaria outra).
// Fica só na sidebar (decisão de produto): "sidebar" = dentro do card de
// Integrações; "icone" = trilho estreito da sidebar.
export function SincronizarBlingButton({
  rotulo = "Sincronizar Bling",
  variante = "sidebar",
  emAndamento = false,
}: {
  rotulo?: string;
  variante?: "sidebar" | "icone";
  emAndamento?: boolean;
}) {
  const router = useRouter();
  const [clicado, iniciar] = useTransition();
  const pendente = clicado || emAndamento;

  function aoClicar() {
    iniciar(async () => {
      try {
        const { novosClientesRegistrados = 0, baixasImportadas = 0, baixas = { detalhadas: 0, pendentes: 0, escopoBorderosAusente: false } } = exigirSucesso(await sincronizarContatosBlingAction());
        toast.success(
          `Bling sincronizado · ${baixasImportadas} ${baixasImportadas === 1 ? "baixa de pagamento importada" : "baixas de pagamento importadas"}` +
            (novosClientesRegistrados > 0 ? ` · ${novosClientesRegistrados} novos clientes` : ""),
          baixas.detalhadas > 0 || baixas.pendentes > 0
            ? {
                description:
                  `Data de baixa de ${baixas.detalhadas} ${baixas.detalhadas === 1 ? "parcela" : "parcelas"}` +
                  (baixas.pendentes > 0 ? ` · ${baixas.pendentes} na próxima sincronização` : ""),
              }
            : undefined,
        );
        if (baixas.escopoBorderosAusente) {
          toast.error("O app do Bling não tem o escopo “Borderôs”", {
            description: "Sem ele, a data de baixa das parcelas não é importada. Reconecte o Bling em Administração · Configurações.",
            duration: 8000,
          });
        }
        // Atualiza a tela e o "há N min" da sidebar (o layout re-renderiza).
        router.refresh();
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Falha ao sincronizar com o Bling.");
      }
    });
  }

  const icone = <MdSync className={cn("size-[18px]", pendente && "animate-spin")} />;

  if (variante === "icone") {
    return (
      <button
        type="button"
        onClick={aoClicar}
        disabled={pendente}
        title={pendente ? "Sincronizando com o Bling…" : "Sincronizar com o Bling"}
        aria-label="Sincronizar com o Bling"
        className="mx-auto flex size-10 items-center justify-center rounded-lg border border-gray5 text-purple-text transition-all duration-200 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
      >
        {icone}
      </button>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={aoClicar} disabled={pendente} className="w-full">
      {icone}
      {pendente ? "Sincronizando…" : rotulo}
    </Button>
  );
}

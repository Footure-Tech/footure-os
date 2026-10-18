"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MdSync } from "react-icons/md";
import { toast } from "sonner";
import type { BuFunil } from "@/lib/supabase/database.types";
import { definirBuFunilAction, sincronizarMarketingAction } from "@/lib/marketing/serverActions";
import { exigirSucesso } from "@/lib/resultadoAcao";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** "Sincronizar agora": continua a carga do histórico (fatias) ou faz o incremental. */
export function SincronizarMarketingButton({ desabilitado }: { desabilitado?: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="white"
      disabled={pendente || desabilitado}
      onClick={() =>
        iniciar(async () => {
          try {
            const { resultados = [] } = exigirSucesso(await sincronizarMarketingAction());
            const erros = resultados.filter((r) => r.status === "erro");
            const parcial = resultados.some((r) => r.status === "parcial");
            const linhas = resultados.reduce((s, r) => s + r.linhas, 0);
            if (erros.length) toast.error("Sincronização com falha", { description: erros.map((e) => `${e.fonte}${e.conta ? ` ${e.conta}` : ""}: ${e.erro}`).join(" · ") });
            else toast.success(`Marketing sincronizado · ${linhas.toLocaleString("pt-BR")} linhas`, parcial ? { description: "A carga do histórico continua na próxima execução (clique de novo ou aguarde o cron das 07:00)." } : undefined);
            router.refresh();
          } catch (erro) {
            toast.error(erro instanceof Error ? erro.message : "Falha ao sincronizar o Marketing.");
          }
        })
      }
    >
      <MdSync className={cn("size-[18px]", pendente && "animate-spin")} />
      {pendente ? "Sincronizando…" : "Sincronizar agora"}
    </Button>
  );
}

const ROTULO_BU: Record<BuFunil, string> = { academy: "Footure Academy", footlink: "Footlink", fora: "Fora (PRO, Insights…)" };

/** BU de um funil do Kommo (P1); a escolha manual não é sobrescrita pela sincronização. */
export function SeletorBuFunil({ pipelineId, bu }: { pipelineId: number; bu: BuFunil }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Select
      items={ROTULO_BU}
      value={bu}
      disabled={pendente}
      onValueChange={(v) =>
        v &&
        v !== bu &&
        iniciar(async () => {
          try {
            exigirSucesso(await definirBuFunilAction(pipelineId, v as BuFunil));
            router.refresh();
          } catch (erro) {
            toast.error(erro instanceof Error ? erro.message : "Falha ao salvar a BU do funil.");
          }
        })
      }
    >
      <SelectTrigger className="h-9 w-[210px]" aria-label="BU do funil">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROTULO_BU) as BuFunil[]).map((k) => (
          <SelectItem key={k} value={k}>
            {ROTULO_BU[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

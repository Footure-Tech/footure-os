"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MdUploadFile } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { prepararUploadContratoBlingAction, registrarArquivoContratoBlingAction } from "@/lib/financeiro/serverActions";

// Anexa o contrato (PDF ou .docx) de um pedido que só existe no Bling. Fluxo:
// servidor autoriza e gera a URL assinada → navegador sobe direto para o
// Storage → servidor registra (ver lib/financeiro/serverActions.ts).
export function AnexarContratoBling({ blingPedidoId, rotulo = "Anexar contrato" }: { blingPedidoId: number; rotulo?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const preparo = await prepararUploadContratoBlingAction(blingPedidoId, arquivo.name, arquivo.size);
      if ("erro" in preparo) throw new Error(preparo.erro);

      const { error } = await createClient()
        .storage.from("contratos")
        .uploadToSignedUrl(preparo.path, preparo.token, arquivo, { contentType: arquivo.type || undefined });
      if (error) throw new Error(`Falha no envio do arquivo: ${error.message}`);

      const registro = await registrarArquivoContratoBlingAction(blingPedidoId, preparo.path, arquivo.name, arquivo.size);
      if (registro.erro) throw new Error(registro.erro);

      toast.success("Contrato anexado", { description: arquivo.name });
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível anexar o contrato.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
      <Button type="button" variant="secondary" disabled={enviando} onClick={() => entrada.current?.click()}>
        <MdUploadFile className="size-4" />
        {enviando ? "Enviando…" : rotulo}
      </Button>
    </>
  );
}

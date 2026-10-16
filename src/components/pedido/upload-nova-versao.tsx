"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { prepararNovaVersaoAction, registrarNovaVersaoAction } from "@/lib/pedidos/serverActions";
import { AnaliseEmAndamento } from "@/components/pedido/analise-em-andamento";

// Nova versão do contrato: o .docx vai do navegador direto para o Storage (URL
// assinada) — o corpo de uma Server Action é limitado a 1 MB e um .docx
// editado no Word passa disso fácil. Depois o servidor registra a versão e
// compara com a anterior (a análise pode levar alguns segundos).
export function UploadNovaVersao({ pedidoId, onSucesso }: { pedidoId: string; onSucesso?: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [etapa, setEtapa] = useState<"parado" | "enviando" | "analisando">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!arquivo) return setErro("Selecione o arquivo .docx editado.");
    setErro(null);
    setEtapa("enviando");
    try {
      const preparo = await prepararNovaVersaoAction(pedidoId, arquivo.name, arquivo.size);
      if (preparo.erro || !preparo.path || !preparo.token || !preparo.versao) throw new Error(preparo.erro ?? "Não foi possível preparar o envio.");
      const { error } = await createClient()
        .storage.from("contratos")
        .uploadToSignedUrl(preparo.path, preparo.token, arquivo, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      if (error) throw new Error(`Falha no envio do arquivo: ${error.message}`);
      setEtapa("analisando");
      const registro = await registrarNovaVersaoAction(pedidoId, preparo.versao, preparo.path, motivo);
      if (registro.erro) throw new Error(registro.erro);
      toast.success(`Versão ${preparo.versao} enviada`, { description: "As mudanças em relação à versão anterior aparecem no card do contrato." });
      onSucesso?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a nova versão.");
    } finally {
      setEtapa("parado");
    }
  }

  if (etapa !== "parado") return <AnaliseEmAndamento key={etapa} etapa={etapa} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label>Arquivo (.docx editado)</Label>
        <Input type="file" accept=".docx" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>O que mudou nessa versão? (opcional)</Label>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ajuda no histórico" rows={2} />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="button" onClick={enviar}>
          Subir versão
        </Button>
      </DialogFooter>
    </div>
  );
}

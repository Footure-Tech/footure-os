"use client";

import { MdFileDownload } from "react-icons/md";
import { Button } from "@/components/ui/button";

// Exporta as linhas já calculadas na tela como CSV (separador ";" e BOM, pra
// abrir certo no Excel em pt-BR). Gerado no navegador — sem rota nova.
export function ExportarCsv({ nomeArquivo, cabecalho, linhas }: { nomeArquivo: string; cabecalho: string[]; linhas: (string | number)[][] }) {
  function exportar() {
    const escapar = (v: string | number) => {
      const texto = String(v);
      return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    const csv = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="white" onClick={exportar} disabled={linhas.length === 0}>
      <MdFileDownload className="size-[18px]" />
      Exportar
    </Button>
  );
}

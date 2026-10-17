"use client";

import { MdErrorOutline, MdRefresh } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ds/estado-vazio";

// Falha ao montar o relatório do curso (ex.: leitura do cache): tentar de novo refaz a busca.
export default function ErroCurso({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="rounded-xl border border-gray5 bg-surface shadow-table">
      <EstadoVazio
        icone={MdErrorOutline}
        titulo="Não foi possível carregar o relatório do curso"
        descricao="Tente de novo em instantes. Se continuar, sincronize o Bling no menu lateral."
        acao={
          <Button type="button" onClick={() => retry()}>
            <MdRefresh className="size-4" />
            Tentar novamente
          </Button>
        }
      />
    </div>
  );
}

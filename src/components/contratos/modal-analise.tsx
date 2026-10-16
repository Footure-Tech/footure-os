"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MdCompareArrows } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AnaliseEmAndamento } from "@/components/pedido/analise-em-andamento";

/** Dentro do modal, a reanálise troca a lista pelo loader (em vez de abrir outro modal por cima). */
const ContextoModalAnalise = createContext<((carregando: boolean) => void) | null>(null);
export const useModalAnalise = () => useContext(ContextoModalAnalise);

// Modal com a lista de mudanças da versão (o conteúdo vem pronto do servidor).
export function ModalAnalise({ rotuloBotao, titulo, descricao, children }: { rotuloBotao: string; titulo: string; descricao: string; children: ReactNode }) {
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  return (
    // Durante a reanálise o modal não fecha (o resultado chega nele ao recarregar).
    <Dialog open={aberto} onOpenChange={(v) => (v || !carregando) && setAberto(v)}>
      <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
        <MdCompareArrows className="size-4" />
        {rotuloBotao}
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl" showCloseButton={!carregando}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <ContextoModalAnalise.Provider value={setCarregando}>
          {carregando && <AnaliseEmAndamento etapa="analisando" />}
          {/* Mantém montado (o botão de reanalisar vive aqui), só escondido durante a análise. */}
          <div className={carregando ? "hidden" : "-mx-1 min-h-0 flex-1 overflow-y-auto px-1"}>{children}</div>
        </ContextoModalAnalise.Provider>
      </DialogContent>
    </Dialog>
  );
}

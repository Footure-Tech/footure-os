"use client";

import type { ReactNode } from "react";
import { MdCompareArrows } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Modal com a lista de mudanças da versão (o conteúdo vem pronto do servidor).
export function ModalAnalise({ rotuloBotao, titulo, descricao, children }: { rotuloBotao: string; titulo: string; descricao: string; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
        <MdCompareArrows className="size-4" />
        {rotuloBotao}
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { MdImageNotSupported, MdZoomIn } from "react-icons/md";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Imagem do criativo no cartão do ranking; clique amplia numa janela (a imagem
// guardada é a original da Meta, ex.: 1080×1080, quando ela existe).
export function ImagemCriativo({ url, nome }: { url: string | null; nome: string }) {
  if (!url)
    return (
      <span className="flex size-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray5 text-gray3" title="Sem imagem na Meta">
        <MdImageNotSupported className="size-7" />
      </span>
    );
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            title="Ampliar o criativo"
            className="group relative shrink-0 self-start overflow-hidden rounded-lg focus-visible:shadow-focus focus-visible:outline-none"
          />
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage */}
        <img src={url} alt={`Criativo ${nome}`} width={112} height={112} className="size-28 rounded-lg border border-gray5 object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <MdZoomIn className="size-7" />
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-[min(92vw,820px)] p-3 sm:max-w-[min(92vw,820px)]">
        <DialogTitle className="pr-10 text-sm font-semibold text-darkPurple1">{nome}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage */}
        <img src={url} alt={`Criativo ${nome}`} className="max-h-[80vh] w-full rounded-lg object-contain" />
      </DialogContent>
    </Dialog>
  );
}

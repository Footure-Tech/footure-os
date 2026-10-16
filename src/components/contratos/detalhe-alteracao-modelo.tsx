"use client";

import Link from "next/link";
import { MdAutoAwesome, MdVisibility } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { EventoModelo } from "@/lib/contratos/historicoModelo";

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Modal com o detalhe de uma alteração do modelo de contrato.
export function DetalheAlteracaoModelo({ evento }: { evento: EventoModelo }) {
  const modelo = `Footlink ${evento.perfil === "clube" ? "Clube" : "Agente"}`;
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="white" size="sm" />}>
        <MdVisibility className="size-4" />
        Ver detalhes
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Modelo {modelo} · v{evento.versao}
          </DialogTitle>
          <DialogDescription>
            {evento.tipo === "agregado" ? "Trecho agregado ao modelo" : "Ajuste desativado — o modelo voltou ao texto original deste trecho"} em{" "}
            {formatarDataHora(evento.data)}
            {evento.usuario ? ` por ${evento.usuario}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {evento.clausula && <p className="text-xs font-bold tracking-[0.06em] text-gray3 uppercase">{evento.clausula}</p>}
          {evento.resumo && (
            <p className="flex items-start gap-2 rounded-lg bg-lightPurple4 px-3 py-2 text-sm text-darkPurple1">
              <MdAutoAwesome className="mt-0.5 size-4 shrink-0 text-purple-text" />
              <span>
                {evento.resumo}
                {evento.motivo && <span className="mt-1 block text-xs text-gray2">{evento.motivo}</span>}
              </span>
            </p>
          )}
          <div className="rounded-lg bg-dangerBg/60 px-3 py-2 text-[13px] leading-relaxed text-darkPurple1">
            <span className="mb-0.5 block text-[10px] font-bold tracking-[0.06em] text-gray3 uppercase">
              {evento.tipo === "agregado" ? "Texto anterior do modelo" : "Texto que deixou de valer"}
            </span>
            {evento.tipo === "agregado" ? evento.trechoOriginal : evento.trechoNovo}
          </div>
          <div className="rounded-lg bg-green5/60 px-3 py-2 text-[13px] leading-relaxed text-darkPurple1">
            <span className="mb-0.5 block text-[10px] font-bold tracking-[0.06em] text-gray3 uppercase">
              {evento.tipo === "agregado" ? "Novo texto do modelo" : "Texto restaurado"}
            </span>
            {evento.tipo === "agregado" ? evento.trechoNovo : evento.trechoOriginal}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-gray3">Origem</dt>
            <dd className="text-darkPurple1">
              {evento.origem ? (
                <Link href={`/pedidos/${evento.origem.pedidoId}`} className="text-purple-text hover:underline">
                  {evento.origem.cliente} · contrato v{evento.origem.versaoContrato}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-gray3">Situação</dt>
            <dd className="text-darkPurple1">
              {evento.ativo
                ? "Ativo — aplicado nos novos contratos"
                : `Desativado${evento.desativadoEm ? ` em ${formatarDataHora(evento.desativadoEm)}` : ""}${evento.desativadoPor ? ` por ${evento.desativadoPor}` : ""}`}
            </dd>
          </dl>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="white" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

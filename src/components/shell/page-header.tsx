import Link from "next/link";
import type { ReactNode } from "react";
import { MdArrowBack } from "react-icons/md";

// Cabeçalho padrão das telas (handoff): micro-rótulo do módulo, H1 e uma
// frase de descrição; ações à direita alinhadas pela base, com quebra.
export function PageHeader({
  modulo,
  titulo,
  descricao,
  acoes,
  voltarHref,
}: {
  modulo?: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  /** Mostra o botão voltar (38×38) à esquerda do título. */
  voltarHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-5">
      <div className="flex min-w-[280px] flex-1 items-start gap-4">
        {voltarHref && <BotaoVoltar href={voltarHref} />}
        <div className="min-w-0">
          {modulo && <span className="text-[11px] font-bold tracking-[0.06em] text-lightPurple1 uppercase">{modulo}</span>}
          <h1 className="mt-0.5 mb-1 text-[28px] leading-tight font-bold tracking-[-0.01em] text-darkPurple1">{titulo}</h1>
          {descricao && <p className="text-sm text-gray">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2.5">{acoes}</div>}
    </div>
  );
}

export function BotaoVoltar({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Voltar"
      title="Voltar"
      className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-gray5 bg-surface text-darkPurple1 transition-all duration-200 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
    >
      <MdArrowBack className="size-5" />
    </Link>
  );
}

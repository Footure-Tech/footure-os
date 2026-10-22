import { MdCancel, MdCheck, MdPriorityHigh, MdRadioButtonUnchecked, MdSchedule } from "react-icons/md";
import { cn } from "@/lib/utils";
import { formatarDataCurta } from "@/lib/formatacao";
import { formatarCnpj } from "@/lib/clientes/formatacao";

import type { SignatarioExibido, SituacaoSignatario } from "@/lib/contratos/signatariosExibidos";

const VISUAL: Record<SituacaoSignatario, { icone: typeof MdCheck; caixa: string; texto: string; rotulo: string }> = {
  assinado: { icone: MdCheck, caixa: "bg-green2 text-white", texto: "text-green1", rotulo: "Assinou" },
  pendente: { icone: MdSchedule, caixa: "bg-orange3 text-[#ce9232]", texto: "text-[#ce9232]", rotulo: "Aguardando assinatura" },
  recusado: { icone: MdCancel, caixa: "bg-dangerBg text-red", texto: "text-red", rotulo: "Recusou" },
  nao_assinou: { icone: MdPriorityHigh, caixa: "bg-dangerBg text-red", texto: "text-red", rotulo: "Não assinou" },
  nao_enviado: { icone: MdRadioButtonUnchecked, caixa: "bg-light text-gray3", texto: "text-gray3", rotulo: "Não enviado" },
};

// Signatários do contrato com o status de cada um na Clicksign (handoff:
// assinado verde com check, pendente laranja com relógio, não enviado cinza).
export function ListaSignatarios({ signatarios }: { signatarios: SignatarioExibido[] }) {
  if (signatarios.length === 0) return <p className="text-sm text-gray3">Nenhum signatário cadastrado no pedido.</p>;
  return (
    <ul className="flex flex-col">
      {signatarios.map((s, i) => {
        const v = VISUAL[s.situacao];
        const Icone = v.icone;
        return (
          <li key={`${s.email ?? s.nome}-${i}`} className="flex items-center gap-3 border-b border-gray5 py-2.5 last:border-0">
            <span className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full", v.caixa)}>
              <Icone className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-darkPurple1">{s.nome}</span>
              <span className="text-xs break-words text-gray3">
                {s.papel}
                {s.email ? ` · ${s.email}` : ""}
                {s.cpf ? ` · CPF ${formatarCnpj(s.cpf)}` : ""}
              </span>
            </div>
            <span className={cn("shrink-0 text-xs font-semibold", v.texto)}>
              {s.situacao === "assinado" && s.assinadoEm ? `Assinou ${formatarDataCurta(s.assinadoEm).slice(0, 5)}` : v.rotulo}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

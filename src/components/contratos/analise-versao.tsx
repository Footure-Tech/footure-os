import { MdAutoAwesome, MdCompareArrows } from "react-icons/md";
import type { AnaliseVersao } from "@/lib/contratos/consultasAnalise";
import { BadgeTom } from "@/components/ds/badge-tom";
import { DecisaoMudanca } from "@/components/contratos/decisao-mudanca";
import { ReanalisarVersaoButton } from "@/components/contratos/reanalisar-versao-button";
import { ModalAnalise } from "@/components/contratos/modal-analise";
import { cn } from "@/lib/utils";

const ROTULO_TIPO = { alterado: "Alterado", incluido: "Incluído", removido: "Removido" } as const;
const ROTULO_DECISAO = { agregar: "Agregado ao modelo", manter: "Só neste contrato" } as const;

function Trecho({ rotulo, texto, tom }: { rotulo: string; texto: string; tom: "antes" | "depois" }) {
  return (
    <div className={cn("rounded-lg px-3 py-2 text-[13px] leading-relaxed", tom === "antes" ? "bg-dangerBg/60 text-darkPurple1" : "bg-green5/60 text-darkPurple1")}>
      <span className="mb-0.5 block text-[10px] font-bold tracking-[0.06em] text-gray3 uppercase">{rotulo}</span>
      {texto}
    </div>
  );
}

// Mudanças da versão enviada pelo jurídico em relação à anterior (0041), com o
// resumo/sugestão da IA e a decisão de agregar (ou não) ao modelo.
export function AnaliseVersaoContrato({
  analise,
  contratoId,
  versao,
  editavel,
}: {
  analise: AnaliseVersao;
  contratoId: string;
  versao: number;
  editavel: boolean;
}) {
  const pendentes = analise.mudancas.filter((m) => m.decisao === "pendente").length;
  const total = analise.mudancas.length;

  const lista = (
    <div className="flex flex-col gap-3">
      {editavel && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray3">
          <span>Compara a versão enviada com o contrato que o modelo de hoje gera para este pedido.</span>
          <ReanalisarVersaoButton contratoId={contratoId} />
        </div>
      )}
      {analise.resumo && (
        <p className="flex items-start gap-2 rounded-lg bg-lightPurple4 px-3 py-2 text-sm text-darkPurple1">
          {analise.resumo_ia && <MdAutoAwesome className="mt-0.5 size-4 shrink-0 text-purple-text" />}
          <span>{analise.resumo}</span>
        </p>
      )}
      {!analise.resumo_ia && total > 0 && <p className="text-xs text-gray3">Resumo por IA indisponível — a lista abaixo é a comparação do texto.</p>}
      <ol className="flex flex-col gap-3">
        {analise.mudancas.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-gray5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeTom tom={m.tipo === "alterado" ? "info" : m.tipo === "incluido" ? "active" : "inactive"}>{ROTULO_TIPO[m.tipo]}</BadgeTom>
              {m.sugestao && <BadgeTom tom={m.sugestao === "modelo" ? "purple" : "pending"}>{m.sugestao === "modelo" ? "Sugestão: modelo" : "Específico do cliente"}</BadgeTom>}
              {m.clausula && <span className="text-xs text-gray3">{m.clausula}</span>}
            </div>
            {m.resumo && <p className="text-sm font-semibold text-darkPurple1">{m.resumo}</p>}
            {m.motivo_sugestao && <p className="text-xs text-gray3">{m.motivo_sugestao}</p>}
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-purple-text select-none">Ver trecho antes e depois</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {m.trecho_original && <Trecho rotulo="Modelo atual" texto={m.trecho_original} tom="antes" />}
                {m.trecho_novo && <Trecho rotulo="Versão enviada" texto={m.trecho_novo} tom="depois" />}
              </div>
            </details>
            {m.decisao === "pendente" ? (
              editavel && <DecisaoMudanca mudancaId={m.id} podeAgregar={m.tipo === "alterado" && m.sugestao !== "especifico"} />
            ) : (
              <span className={cn("text-xs font-bold", m.decisao === "agregar" ? "text-green1" : "text-gray2")}>{ROTULO_DECISAO[m.decisao]}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );

  // No card, só o resumo compacto + botão; a lista abre em modal (evita rolagem longa).
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray5 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
          <MdCompareArrows className="size-4" />
          Mudanças da v{versao} em relação ao modelo
        </span>
        <span className="text-sm text-darkPurple1">
          {analise.status === "pendente"
            ? "Análise em andamento…"
            : analise.status === "erro"
              ? `Não foi possível analisar: ${analise.erro}`
              : total === 0
                ? "Nenhuma diferença em relação ao modelo atual."
                : `${total} ${total === 1 ? "mudança identificada" : "mudanças identificadas"} · ${pendentes > 0 ? `${pendentes} para decidir` : "todas decididas"}`}
        </span>
      </div>
      {analise.status === "concluida" && total > 0 ? (
        <ModalAnalise
          rotuloBotao={`Analisar mudanças (${total})`}
          titulo={`Mudanças da v${versao} em relação ao modelo atual`}
          descricao="Decida o que vai para o modelo de contrato e o que fica só neste contrato."
        >
          {lista}
        </ModalAnalise>
      ) : (
        editavel && analise.status !== "pendente" && <ReanalisarVersaoButton contratoId={contratoId} />
      )}
    </div>
  );
}

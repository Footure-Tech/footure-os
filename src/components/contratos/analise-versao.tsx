import { MdAutoAwesome, MdCompareArrows } from "react-icons/md";
import type { AnaliseVersao } from "@/lib/contratos/consultasAnalise";
import { ListaMudancas } from "@/components/contratos/lista-mudancas";
import { ReanalisarVersaoButton } from "@/components/contratos/reanalisar-versao-button";
import { ModalAnalise } from "@/components/contratos/modal-analise";

// Mudanças da versão enviada pelo jurídico em relação ao modelo atual (0041):
// resumo compacto no card e, no modal, a lista com abas, filtros e decisões.
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
      <ListaMudancas mudancas={analise.mudancas} editavel={editavel} />
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

import { MdAutoAwesome, MdCompareArrows } from "react-icons/md";
import type { AnaliseVersao } from "@/lib/contratos/consultasAnalise";
import { BadgeTom } from "@/components/ds/badge-tom";
import { DecisaoMudanca } from "@/components/contratos/decisao-mudanca";
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
export function AnaliseVersaoContrato({ analise, versao, editavel }: { analise: AnaliseVersao; versao: number; editavel: boolean }) {
  const pendentes = analise.mudancas.filter((m) => m.decisao === "pendente").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">
          <MdCompareArrows className="size-4" />
          Mudanças da v{versao}
          {analise.versaoBase ? ` em relação à v${analise.versaoBase}` : ""}
        </span>
        {analise.mudancas.length > 0 && (
          <span className="text-xs font-semibold text-gray2">{pendentes > 0 ? `${pendentes} para decidir` : "todas decididas"}</span>
        )}
      </div>

      {analise.status === "erro" ? (
        <p className="rounded-lg bg-orange3 px-3 py-2 text-xs font-semibold text-[#ce9232]">Não foi possível analisar esta versão: {analise.erro}</p>
      ) : analise.status === "pendente" ? (
        <p className="text-sm text-gray3">Análise em andamento…</p>
      ) : (
        <>
          {analise.resumo && (
            <p className="flex items-start gap-2 rounded-lg bg-lightPurple4 px-3 py-2 text-sm text-darkPurple1">
              {analise.resumo_ia && <MdAutoAwesome className="mt-0.5 size-4 shrink-0 text-purple-text" />}
              <span>{analise.resumo}</span>
            </p>
          )}
          {!analise.resumo_ia && analise.mudancas.length > 0 && (
            <p className="text-xs text-gray3">Resumo por IA indisponível — a lista abaixo é a comparação do texto.</p>
          )}
          <ol className="flex flex-col gap-3">
            {analise.mudancas.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-gray5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeTom tom={m.tipo === "alterado" ? "info" : m.tipo === "incluido" ? "active" : "inactive"}>{ROTULO_TIPO[m.tipo]}</BadgeTom>
                  {m.sugestao && (
                    <BadgeTom tom={m.sugestao === "modelo" ? "purple" : "pending"}>{m.sugestao === "modelo" ? "Sugestão: modelo" : "Específico do cliente"}</BadgeTom>
                  )}
                  {m.clausula && <span className="text-xs text-gray3">{m.clausula}</span>}
                </div>
                {m.resumo && <p className="text-sm font-semibold text-darkPurple1">{m.resumo}</p>}
                {m.motivo_sugestao && <p className="text-xs text-gray3">{m.motivo_sugestao}</p>}
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-purple-text select-none">Ver trecho antes e depois</summary>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.trecho_original && <Trecho rotulo="Antes" texto={m.trecho_original} tom="antes" />}
                    {m.trecho_novo && <Trecho rotulo="Depois" texto={m.trecho_novo} tom="depois" />}
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
        </>
      )}
    </div>
  );
}

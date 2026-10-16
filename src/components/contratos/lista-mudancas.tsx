"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { MdCheck, MdCheckCircle, MdDoneAll } from "react-icons/md";
import type { AnaliseVersao } from "@/lib/contratos/consultasAnalise";
import { decidirMudancaAction, manterMudancasEmLoteAction } from "@/lib/contratos/analiseActions";
import { Button } from "@/components/ui/button";
import { AbasFiltro, SegmentedToggle } from "@/components/ds/alternadores";
import { BadgeTom } from "@/components/ds/badge-tom";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { cn } from "@/lib/utils";

type Mudanca = AnaliseVersao["mudancas"][number];
type Decisao = "agregar" | "manter";
type Aba = "pendentes" | "analisados";
type Filtro = "modelo" | "contrato" | "todos";

const ROTULO_TIPO = { alterado: "Alterado", incluido: "Incluído", removido: "Removido" } as const;
const ROTULO_DECISAO = { agregar: "Agregado ao modelo", manter: "Só neste contrato" } as const;
/** Pode ir para o modelo: alteração de texto que a análise não marcou como específica do cliente. */
const podeAgregar = (m: Mudanca) => m.tipo === "alterado" && m.sugestao !== "especifico";
const DURACAO_SAIDA = 900; // = animação .mudanca-concluida

function Trecho({ rotulo, texto, tom }: { rotulo: string; texto: string; tom: "antes" | "depois" }) {
  return (
    <div className={cn("rounded-lg px-3 py-2 text-[13px] leading-relaxed text-darkPurple1", tom === "antes" ? "bg-dangerBg/60" : "bg-green5/60")}>
      <span className="mb-0.5 block text-[10px] font-bold tracking-[0.06em] text-gray3 uppercase">{rotulo}</span>
      {texto}
    </div>
  );
}

// Lista de mudanças do modal de análise: abas (para analisar × analisados),
// filtros e decisões. Ao decidir, o item confirma ("Concluído") e sai da lista
// de pendentes; as decisões aparecem na hora (estado local) e são salvas no servidor.
export function ListaMudancas({ mudancas, editavel }: { mudancas: Mudanca[]; editavel: boolean }) {
  const [aba, setAba] = useState<Aba>("pendentes");
  const [filtro, setFiltro] = useState<Filtro>("modelo");
  // Decisões já feitas nesta tela (antes de o servidor devolver a lista atualizada).
  const [locais, setLocais] = useState<Record<string, Decisao>>({});
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState<Set<string>>(new Set());
  const [emLote, iniciarLote] = useTransition();

  const decisaoDe = (m: Mudanca): Decisao | null => (m.decisao !== "pendente" ? m.decisao : (locais[m.id] ?? null));
  const pendentes = mudancas.filter((m) => !decisaoDe(m) || saindo.has(m.id));
  const analisados = mudancas.filter((m) => decisaoDe(m) && !saindo.has(m.id));
  const base = aba === "pendentes" ? pendentes : analisados;
  const contar = (lista: Mudanca[], f: Filtro) => lista.filter((m) => f === "todos" || (f === "modelo" ? podeAgregar(m) : !podeAgregar(m))).length;
  const visiveis = useMemo(
    () => base.filter((m) => filtro === "todos" || (filtro === "modelo" ? podeAgregar(m) : !podeAgregar(m))),
    [base, filtro],
  );
  const lotePendente = pendentes.filter((m) => !podeAgregar(m) && !saindo.has(m.id));

  /** Marca a decisão: confirma no item, anima a saída e só então o move para "Analisados". */
  function concluir(ids: string[], decisao: Decisao) {
    setSaindo((s) => new Set([...s, ...ids]));
    setLocais((l) => ({ ...l, ...Object.fromEntries(ids.map((id) => [id, decisao])) }));
    setTimeout(() => setSaindo((s) => new Set([...s].filter((id) => !ids.includes(id)))), DURACAO_SAIDA);
  }

  async function decidir(m: Mudanca, decisao: Decisao) {
    setSalvando((s) => new Set(s).add(m.id));
    const r = await decidirMudancaAction(m.id, decisao);
    setSalvando((s) => new Set([...s].filter((id) => id !== m.id)));
    if (r.erro) {
      toast.error(decisao === "agregar" ? "Não foi possível agregar ao modelo" : "Não foi possível salvar", { description: r.erro });
      return;
    }
    concluir([m.id], decisao);
  }

  function manterTodos() {
    const ids = lotePendente.map((m) => m.id);
    iniciarLote(async () => {
      const r = await manterMudancasEmLoteAction(ids);
      if (r.erro) return void toast.error("Não foi possível salvar as decisões", { description: r.erro });
      concluir(ids, "manter");
      toast.success(`${ids.length} ${ids.length === 1 ? "mudança mantida" : "mudanças mantidas"} só neste contrato`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <AbasFiltro
        valor={aba}
        onChange={setAba}
        opcoes={[
          { valor: "pendentes", rotulo: "Para analisar", contagem: pendentes.filter((m) => !saindo.has(m.id)).length },
          { valor: "analisados", rotulo: "Analisados", contagem: analisados.length },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedToggle
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: "modelo", rotulo: `Podem ir para o modelo (${contar(base, "modelo")})` },
            { valor: "contrato", rotulo: `Só neste contrato (${contar(base, "contrato")})` },
            { valor: "todos", rotulo: `Todos (${base.length})` },
          ]}
        />
        {editavel && aba === "pendentes" && filtro === "contrato" && lotePendente.length > 0 && (
          <Button type="button" size="sm" disabled={emLote} onClick={manterTodos}>
            <MdDoneAll className="size-4" />
            {emLote ? "Salvando…" : `Manter todos só neste contrato (${lotePendente.length})`}
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          compacto
          icone={aba === "pendentes" ? MdCheckCircle : MdDoneAll}
          titulo={aba === "pendentes" ? "Nada para analisar neste filtro" : "Nenhuma mudança analisada neste filtro"}
          descricao={aba === "pendentes" ? "Confira os outros filtros ou a aba Analisados." : "As mudanças decididas aparecem aqui."}
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {visiveis.map((m) => {
            const decisao = decisaoDe(m);
            const concluindo = saindo.has(m.id);
            const ocupado = salvando.has(m.id) || emLote;
            return (
              <li
                key={m.id}
                className={cn(
                  "relative flex flex-col gap-2 overflow-hidden rounded-lg border p-3 transition-colors duration-300",
                  concluindo ? "mudanca-concluida border-green2/50 bg-green5/40" : "border-gray5",
                )}
              >
                {concluindo && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-green2 px-2.5 py-1 text-xs font-bold text-white">
                    <MdCheck className="size-4" />
                    Concluído
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2 pr-24">
                  <BadgeTom tom={m.tipo === "alterado" ? "info" : m.tipo === "incluido" ? "active" : "inactive"}>{ROTULO_TIPO[m.tipo]}</BadgeTom>
                  {m.sugestao && <BadgeTom tom={m.sugestao === "modelo" ? "purple" : "pending"}>{m.sugestao === "modelo" ? "Sugestão: modelo" : "Específico do cliente"}</BadgeTom>}
                  {m.clausula && <span className="text-xs text-gray3">{m.clausula}</span>}
                </div>
                {m.resumo && <p className="text-sm font-semibold text-darkPurple1">{m.resumo}</p>}
                {m.motivo_sugestao && <p className="text-xs text-gray3">{m.motivo_sugestao}</p>}
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-purple-text select-none">Ver trecho antes e depois</summary>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.trecho_original && <Trecho rotulo="Modelo atual" texto={m.trecho_original} tom="antes" />}
                    {m.trecho_novo && <Trecho rotulo="Versão enviada" texto={m.trecho_novo} tom="depois" />}
                  </div>
                </details>
                {decisao ? (
                  !concluindo && (
                    <span className={cn("flex items-center gap-1 text-xs font-bold", decisao === "agregar" ? "text-green1" : "text-gray2")}>
                      <MdCheckCircle className="size-4" />
                      {ROTULO_DECISAO[decisao]}
                    </span>
                  )
                ) : (
                  editavel && (
                    <div className="flex flex-wrap gap-2">
                      {podeAgregar(m) && (
                        <Button type="button" size="sm" disabled={ocupado} onClick={() => decidir(m, "agregar")}>
                          <MdCheck className="size-4" />
                          {salvando.has(m.id) ? "Agregando…" : "Agregar ao modelo"}
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="white" disabled={ocupado} onClick={() => decidir(m, "manter")}>
                        Manter só neste contrato
                      </Button>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

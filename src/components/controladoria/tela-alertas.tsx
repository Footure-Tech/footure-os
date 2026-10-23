import Link from "next/link";
import { MdNotificationsNone } from "react-icons/md";
import type { AbaAlertas, carregarTelaAlertas } from "@/lib/controladoria/consultas";
import type { TipoEventoAlerta } from "@/lib/supabase/database.types";
import { formatarDataCurta, formatarMoeda, tempoDecorrido } from "@/lib/formatacao";
import { PageHeader } from "@/components/shell/page-header";
import { AbasFiltro } from "@/components/ds/alternadores";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { AcoesAlerta, BotaoAtualizarDados } from "./acoes";
import { ROTULO_GRUPO, SEVERIDADE_VISUAL, STATUS_ALERTA_VISUAL } from "./visual";

type Dados = Awaited<ReturnType<typeof carregarTelaAlertas>>;

const ROTULO_EVENTO: Record<TipoEventoAlerta, string> = {
  criado: "Criado",
  reaberto: "Reaberto",
  atribuido: "Atribuído",
  adiado: "Adiado",
  encerrado: "Encerrado",
  reativado: "De volta à fila",
  resolvido: "Resolvido",
};

// Controladoria · Alertas (spec §4): fila com responsável, adiamento e encerramento.
export function TelaAlertas({ dados, aba }: { dados: Dados; aba: AbaAlertas }) {
  const { alertas, contagens, pessoas, hoje } = dados;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        modulo="Controladoria"
        titulo="Alertas"
        descricao="Reavaliados a cada sincronização (5h e 16h). Um alerta some sozinho quando a condição deixa de existir."
        acoes={<BotaoAtualizarDados />}
      />
      <AbasFiltro
        valor={aba}
        opcoes={[
          { valor: "abertos", rotulo: "Abertos", href: "/controladoria/alertas", contagem: contagens.abertos },
          { valor: "adiados", rotulo: "Adiados", href: "/controladoria/alertas?aba=adiados", contagem: contagens.adiados },
          { valor: "encerrados", rotulo: "Encerrados", href: "/controladoria/alertas?aba=encerrados", contagem: contagens.encerrados },
          { valor: "resolvidos", rotulo: "Resolvidos (30 dias)", href: "/controladoria/alertas?aba=resolvidos", contagem: contagens.resolvidos },
        ]}
      />
      {alertas.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdNotificationsNone} titulo={aba === "abertos" ? "Nenhum alerta aberto" : "Nada nesta lista"} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alertas.map((a) => (
            <article key={a.id} className="flex flex-col gap-3 rounded-xl border border-gray5 bg-surface px-6 py-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tom={SEVERIDADE_VISUAL[a.severidade].tom}>{SEVERIDADE_VISUAL[a.severidade].rotulo}</StatusPill>
                <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">{ROTULO_GRUPO[a.grupo]}</span>
                <StatusPill tom={STATUS_ALERTA_VISUAL[a.status].tom}>{STATUS_ALERTA_VISUAL[a.status].rotulo}</StatusPill>
                {a.status === "adiado" && a.adiado_ate && <span className="text-xs text-gray2">até {formatarDataCurta(a.adiado_ate)}</span>}
                <span className="ml-auto text-xs text-gray3">aberto {tempoDecorrido(a.criado_em)}</span>
              </div>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
                <h2 className="min-w-[280px] flex-1 text-base font-bold text-darkPurple1">{a.titulo}</h2>
                {a.valor !== null && <span className="text-base font-extrabold text-darkPurple1">{formatarMoeda(Math.round(a.valor))}</span>}
              </div>
              <p className="text-sm text-gray2">{a.descricao}</p>
              <p className="text-sm text-darkPurple1">
                <strong className="font-semibold">O que fazer:</strong> {a.acao}
                {a.href && (
                  <Link href={a.href} className="ml-1.5 font-semibold text-purple-text hover:underline">
                    Abrir
                  </Link>
                )}
              </p>
              {(a.responsavel || a.motivo) && (
                <p className="text-xs text-gray2">
                  {a.responsavel && <>Responsável: <strong className="font-semibold text-darkPurple1">{a.responsavel}</strong></>}
                  {a.responsavel && a.motivo && " · "}
                  {a.motivo && <>Nota: {a.motivo}</>}
                </p>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray5 pt-3">
                <ul className="flex flex-col gap-0.5 text-xs text-gray3">
                  {a.eventos.map((e) => (
                    <li key={e.id}>
                      {formatarDataCurta(e.criado_em)} · {ROTULO_EVENTO[e.tipo]}
                      {e.detalhe ? ` · ${e.detalhe}` : ""}
                      {e.autor ? ` · ${e.autor}` : ""}
                    </li>
                  ))}
                </ul>
                <AcoesAlerta alerta={a} pessoas={pessoas} hoje={hoje} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { formatarDataCurta } from "@/lib/formatacao";
import { ROTULO_STATUS } from "@/components/rotulo-status";
import type { StatusPedido } from "@/lib/supabase/database.types";

export interface EventoTimeline {
  id: string;
  data: string;
  /** Autor do evento; sem nome (ex.: eventos vindos do Bling) a linha mostra só a data. */
  nome?: string | null;
  titulo: string;
  comentario?: string | null;
  /** Data sem hora (aaaa-mm-dd, como as do Bling) — exibe só o dia. */
  soData?: boolean;
}

/** de = para é registro sem mudança de status: substituição do PV no Bling (blingPedido.ts) ou atualização automática do contrato (pedidos/acoes.ts). */
export function tituloTransicao(t: { de: StatusPedido | null; para: StatusPedido; comentario?: string | null }) {
  if (t.de === t.para) {
    if (t.comentario?.startsWith("Pedido alterado depois do envio ao Bling")) return "Pedido substituído no Bling";
    if (/nova versão v\d+ gerada/.test(t.comentario ?? "")) return "Nova versão do contrato";
    return "Aviso sobre o contrato";
  }
  return `${t.de ? ROTULO_STATUS[t.de] : "Criado"} → ${ROTULO_STATUS[t.para]}`;
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Timeline vertical, mais recente primeiro (ordem já vem pronta de quem chama) —
// ponto + linha conectora entre eventos, no padrão de histórico do design system.
export function TimelineTransicoes({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) return <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>;

  return (
    <div className="flex flex-col">
      {eventos.map((e, i) => (
        <div key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < eventos.length - 1 && <span className="absolute top-3 left-[5px] h-[calc(100%-0.5rem)] w-px bg-border" />}
          <span className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-primary bg-card" />
          <div className="flex flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold text-foreground">{e.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {e.soData ? formatarDataCurta(e.data) : formatarDataHora(e.data)}
              {e.nome ? ` · por ${e.nome}` : ""}
            </p>
            {e.comentario && <p className="mt-1 text-sm text-foreground">{e.comentario}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

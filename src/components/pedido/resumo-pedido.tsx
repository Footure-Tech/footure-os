import { MdWarning } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { formatarMoeda, mesesEntre, rotuloPagamento } from "@/lib/formatacao";
import { ROTULO_MEIO_PAGAMENTO } from "@/lib/contratos/meioPagamento";
import type { FormaPagamento, MeioPagamento } from "@/lib/supabase/database.types";

export type IntencaoEnvio = "rascunho" | "enviar";

const MODELO_CONTRATO = { clube: "Footlink Clube", agente: "Footlink Agente" } as const;

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="flex-1 text-sm text-gray">{rotulo}</span>
      <span className={destaque ? "text-right font-bold text-darkPurple1" : "text-right text-sm font-semibold text-darkPurple1"}>{valor}</span>
    </div>
  );
}

// Resumo fixo do "Novo pedido de venda" (handoff), recalculado a cada
// alteração do formulário. As "próximas etapas" descrevem o fluxo REAL
// (aprovação da diretoria → contrato gerado automaticamente → Clicksign);
// a criação de parcelas no Bling ainda não existe, então não é prometida aqui.
export function ResumoPedido({
  clienteNome,
  perfil,
  plano,
  incluiApi,
  valorTotal,
  valorMensal,
  formaPagamento,
  meioPagamento,
  numeroParcelas,
  vigenciaInicio,
  vigenciaFim,
  qtdAlertas,
  pendente,
  intencao,
  aoEscolherIntencao,
}: {
  clienteNome: string;
  perfil: "clube" | "agente";
  plano: string;
  incluiApi: boolean;
  valorTotal: number;
  valorMensal: number;
  formaPagamento: FormaPagamento;
  meioPagamento: MeioPagamento;
  numeroParcelas: number;
  vigenciaInicio: string;
  vigenciaFim: string;
  qtdAlertas: number;
  pendente: boolean;
  intencao: IntencaoEnvio;
  aoEscolherIntencao: (intencao: IntencaoEnvio) => void;
}) {
  const nomePlano = plano ? (buscarPlanoPorKey(plano)?.canonical ?? plano) : null;
  const produto = ["Footlink" + (incluiApi ? " + API" : ""), perfil === "clube" ? "Clube" : "Agente", nomePlano].filter(Boolean).join(" · ");
  const parcelado = formaPagamento === "parcelado";
  const meses = mesesEntre(vigenciaInicio, vigenciaFim);

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-gray5 bg-surface p-6 shadow-card lg:sticky lg:top-[90px]">
      <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Resumo do pedido</span>
      <div className="flex flex-col gap-1">
        <span className="text-xl font-bold text-darkPurple1">{clienteNome || "Cliente não selecionado"}</span>
        <span className="text-sm text-gray">{produto}</span>
      </div>

      <div className="flex flex-col gap-2.5 border-y border-gray5 py-4">
        <Linha rotulo="Valor total" valor={formatarMoeda(valorTotal)} destaque />
        <Linha rotulo="Forma" valor={parcelado ? ROTULO_MEIO_PAGAMENTO[meioPagamento] : rotuloPagamento(formaPagamento, meioPagamento, null)} />
        <Linha rotulo="Parcela" valor={parcelado ? `${numeroParcelas}x de ${formatarMoeda(valorMensal)}` : "À vista"} />
        <Linha rotulo="Vigência" valor={meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "—"} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[0.06em] text-gray3 uppercase">Próximas etapas</span>
        <span className="text-[13px] text-gray2">1. Diretoria aprova o pedido</span>
        <span className="text-[13px] text-gray2">2. Contrato gerado do modelo {MODELO_CONTRATO[perfil]} e validado pelo jurídico</span>
        <span className="text-[13px] text-gray2">3. Envio para assinatura via Clicksign</span>
      </div>

      {qtdAlertas > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-orange3 px-3 py-2 text-sm font-semibold text-[#ce9232]">
          <MdWarning className="size-4 shrink-0" />
          {qtdAlertas} {qtdAlertas === 1 ? "ponto" : "pontos"} para revisar
        </div>
      )}

      <Button type="submit" disabled={pendente} className="w-full" onClick={() => aoEscolherIntencao("enviar")}>
        {pendente && intencao === "enviar" ? "Enviando…" : "Enviar para aprovação"}
      </Button>
      <Button type="submit" variant="white" disabled={pendente} className="w-full" onClick={() => aoEscolherIntencao("rascunho")}>
        {pendente && intencao === "rascunho" ? "Salvando…" : "Salvar rascunho"}
      </Button>
    </aside>
  );
}

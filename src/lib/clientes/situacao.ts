import type { StatusPedido } from "@/lib/supabase/database.types";

export type SituacaoCliente = "em_dia" | "atrasado" | "cancelado" | "inativo" | "sem_contrato";

interface PedidoLocal {
  status: StatusPedido;
  vigencia_inicio: string;
  vigencia_fim: string;
  criado_em: string;
}

export interface ResultadoSituacaoCliente {
  situacao: SituacaoCliente;
  contratoVigente: PedidoLocal | null;
}

/**
 * A maioria dos clientes reais nunca passou pelo nosso fluxo de pedido (só
 * existe pedido de venda no Bling) — nesse caso a situação vem inteira do
 * Bling. Quando existe um contrato local, ele manda primeiro (vigência):
 * "atrasado" só é possível com um contrato em vigor — se o contrato mais
 * recente já encerrou (vigencia_fim no passado) o cliente vira "inativo"
 * independente de parcelas do Bling.
 *
 * "Em dia" exige parcela futura em aberto de verdade — sem isso (tudo já
 * recebido, ou pedido antigo sem nenhuma parcela pendente) não tem nada
 * ativo acontecendo, então é "inativo" mesmo sem nenhuma parcela atrasada.
 * Exceção: cliente com contrato local vigente mas sem nenhum dado do Bling
 * pro CNPJ dele (totalPedidosBling = 0, ex.: ainda não faturado lá) continua
 * "em dia" pela vigência local — nesse caso não dá pra concluir "inativo" só
 * por falta de dado.
 *
 * `temContratoBlingVigente`: algum pedido de venda do Bling (não cancelado)
 * com vigência informada na plataforma (0034) ainda em curso — conta como
 * "em dia" mesmo sem parcela a vencer (ex.: pagou à vista).
 */
export function calcularSituacaoCliente(
  pedidosLocais: PedidoLocal[],
  temParcelaAtrasadaBling = false,
  temParcelaAVencerBling = false,
  totalPedidosBling = 0,
  temContratoBlingVigente = false,
): ResultadoSituacaoCliente {
  const naoCancelados = pedidosLocais.filter((p) => p.status !== "cancelado");

  if (pedidosLocais.length > 0 && naoCancelados.length === 0) return { situacao: "cancelado", contratoVigente: null };

  if (naoCancelados.length > 0) {
    const contratoAtual = [...naoCancelados].sort((a, b) => b.vigencia_fim.localeCompare(a.vigencia_fim))[0];
    const hoje = new Date().toISOString().slice(0, 10);
    if (contratoAtual.vigencia_fim < hoje) return { situacao: "inativo", contratoVigente: null };
    if (temParcelaAtrasadaBling) return { situacao: "atrasado", contratoVigente: contratoAtual };
    if (totalPedidosBling === 0 || temParcelaAVencerBling || temContratoBlingVigente) return { situacao: "em_dia", contratoVigente: contratoAtual };
    return { situacao: "inativo", contratoVigente: null };
  }

  if (totalPedidosBling === 0) return { situacao: "sem_contrato", contratoVigente: null };
  if (temParcelaAtrasadaBling) return { situacao: "atrasado", contratoVigente: null };
  return { situacao: temParcelaAVencerBling || temContratoBlingVigente ? "em_dia" : "inativo", contratoVigente: null };
}

export const ROTULO_SITUACAO_CLIENTE: Record<SituacaoCliente, string> = {
  em_dia: "Em dia",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  inativo: "Inativo",
  sem_contrato: "Sem contrato",
};

export const VARIANTE_SITUACAO_CLIENTE: Record<SituacaoCliente, "success" | "destructive" | "neutral" | "warning"> = {
  em_dia: "success",
  atrasado: "destructive",
  cancelado: "neutral",
  inativo: "neutral",
  sem_contrato: "neutral",
};

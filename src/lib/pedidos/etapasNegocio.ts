// Stepper da tela Negócio: Pedido · Aprovação · Contrato · Assinatura ·
// Concluído (decisão de produto — o "Lead" do handoff está em backlog e o
// fluxo real tem a aprovação da diretoria). Função pura, derivada só do status
// atual e do histórico de transições.
import type { StatusPedido } from "@/lib/supabase/database.types";
import { formatarDataCurta } from "@/lib/formatacao";

export interface EtapaNegocio {
  titulo: string;
  subtitulo?: string;
}

const INDICE_POR_STATUS: Record<Exclude<StatusPedido, "cancelado">, number> = {
  rascunho: 0,
  em_aprovacao: 1,
  aprovado: 2,
  em_revisao_juridica: 2,
  pronto_para_assinatura: 2,
  enviado_para_assinatura: 3,
  // Assinado já encerra o fluxo do sistema: todas as etapas concluídas.
  assinado: 5,
  concluido: 5,
};

interface Transicao {
  de: StatusPedido | null;
  para: StatusPedido;
  criado_em: string;
}

function ultimaData(transicoes: Transicao[], para: StatusPedido) {
  const t = [...transicoes].reverse().find((x) => x.para === para);
  return t ? formatarDataCurta(t.criado_em) : null;
}

export function montarEtapasNegocio({
  status,
  criadoEm,
  transicoes,
  versaoContrato,
  geracaoContratoErro,
  assinaturas,
  semContrato = false,
  bling,
}: {
  status: StatusPedido;
  criadoEm: string;
  transicoes: Transicao[];
  versaoContrato: number | null;
  geracaoContratoErro: string | null;
  /** null = contrato sem status por signatário (enviado antes da 0027 ou ainda não enviado). */
  assinaturas: { assinados: number; total: number; encerrada?: boolean } | null;
  /** 0040: pedido sem contrato — Pedido · Aprovação · Bling · Concluído. */
  semContrato?: boolean;
  bling?: { numero: string | null; erro: string | null };
}): { etapas: EtapaNegocio[]; atual: number; canceladoEm: number | null } {
  // Cancelado: o stepper congela na etapa em que o pedido estava ao ser cancelado.
  let statusEfetivo: StatusPedido = status;
  if (status === "cancelado") {
    const cancelamento = [...transicoes].reverse().find((t) => t.para === "cancelado");
    statusEfetivo = cancelamento?.de && cancelamento.de !== "cancelado" ? cancelamento.de : "rascunho";
  }
  const atual = INDICE_POR_STATUS[statusEfetivo as Exclude<StatusPedido, "cancelado">];

  if (semContrato) {
    // rascunho 0 · em aprovação 1 · aprovado (aguardando/erro no Bling) 2 · concluído 4 (todas feitas)
    const atualSem = statusEfetivo === "concluido" ? 4 : Math.min(atual, 2);
    const concluidoEm = ultimaData(transicoes, "concluido");
    return {
      etapas: [
        { titulo: "Pedido", subtitulo: statusEfetivo === "rascunho" ? "Rascunho" : `Criado em ${formatarDataCurta(criadoEm)}` },
        {
          titulo: "Aprovação",
          subtitulo: atualSem === 1 ? "Aguardando diretoria" : atualSem > 1 ? `Aprovado${ultimaData(transicoes, "aprovado") ? ` em ${ultimaData(transicoes, "aprovado")}` : ""}` : undefined,
        },
        {
          titulo: "Bling",
          subtitulo: bling?.numero ? `Pedido nº ${bling.numero}` : atualSem === 2 ? (bling?.erro ? "Falha no envio" : "Enviando") : undefined,
        },
        { titulo: "Concluído", subtitulo: atualSem === 4 ? (concluidoEm ? `Em ${concluidoEm} · sem contrato` : "Sem contrato") : undefined },
      ],
      atual: atualSem === 4 ? 4 : atualSem,
      canceladoEm: status === "cancelado" ? atualSem : null,
    };
  }

  const subtituloAprovacao =
    atual === 1 ? "Aguardando diretoria" : atual > 1 ? (ultimaData(transicoes, "aprovado") ? `Aprovado em ${ultimaData(transicoes, "aprovado")}` : "Aprovado") : undefined;

  let subtituloContrato: string | undefined;
  if (atual === 2) {
    if (statusEfetivo === "aprovado") subtituloContrato = geracaoContratoErro ? "Falha na geração" : "Em geração";
    else subtituloContrato = `${versaoContrato ? `v${versaoContrato} · ` : ""}Em validação`;
  } else if (atual > 2 && versaoContrato) {
    subtituloContrato = `v${versaoContrato}`;
  }

  let subtituloAssinatura: string | undefined;
  if (atual >= 3) {
    subtituloAssinatura = assinaturas
      ? `${assinaturas.encerrada ? "Encerrada" : "Clicksign"} · ${assinaturas.assinados}/${assinaturas.total}`
      : "Clicksign";
  }

  const assinadoEm = ultimaData(transicoes, "assinado");

  return {
    etapas: [
      { titulo: "Pedido", subtitulo: statusEfetivo === "rascunho" ? "Rascunho" : `Criado em ${formatarDataCurta(criadoEm)}` },
      { titulo: "Aprovação", subtitulo: subtituloAprovacao },
      { titulo: "Contrato", subtitulo: subtituloContrato },
      { titulo: "Assinatura", subtitulo: subtituloAssinatura },
      { titulo: "Concluído", subtitulo: atual === 5 ? (assinadoEm ? `Assinado em ${assinadoEm}` : "Assinado") : undefined },
    ],
    atual,
    canceladoEm: status === "cancelado" ? atual : null,
  };
}

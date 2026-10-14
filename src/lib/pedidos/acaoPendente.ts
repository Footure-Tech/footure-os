// Função pura (sem "use client"/"use server") — só lógica, sem estado. Fica
// num módulo neutro porque precisa ser chamada tanto de Server Components
// (ProximaAcao) quanto reaproveitada perto de AcoesPedido (client): um
// export vindo de um arquivo "use client" não pode ser invocado direto do
// server, mesmo sendo uma função pura sem nenhum hook.
import type { PapelUsuario, StatusPedido } from "@/lib/supabase/database.types";

export interface AcaoPendente {
  titulo: string;
  descricao: string;
}

/** Espelha as condições de AcoesPedido — decide se/qual destaque mostrar sem duplicar quais botões aparecem. */
export function acaoPendente(status: StatusPedido, papel: PapelUsuario, donoDoRascunho: boolean): AcaoPendente | null {
  if (status === "rascunho" && donoDoRascunho) {
    return { titulo: "Pedido em rascunho", descricao: "Revise os dados e envie para aprovação quando estiver pronto." };
  }
  if (status === "em_aprovacao" && papel === "admin") {
    return { titulo: "Aguardando sua aprovação", descricao: "Confira os dados e os alertas abaixo antes de aprovar ou reprovar." };
  }
  if (status === "aprovado" && (papel === "admin" || papel === "juridico")) {
    return { titulo: "Geração do contrato falhou", descricao: "A última tentativa não gerou o contrato — corrija o problema e tente novamente." };
  }
  if (status === "em_revisao_juridica" && (papel === "juridico" || papel === "admin")) {
    return {
      titulo: "Contrato em revisão",
      descricao: "Baixe, ajuste se precisar e suba uma nova versão, ou libere para assinatura quando estiver pronto.",
    };
  }
  if (status === "pronto_para_assinatura" && (papel === "juridico" || papel === "admin")) {
    return {
      titulo: "Pronto para assinatura",
      descricao: "Dispare o envio para assinatura, ou cancele o processo se precisar editar o pedido de novo.",
    };
  }
  if (status === "enviado_para_assinatura" && (papel === "juridico" || papel === "admin")) {
    return {
      titulo: "Aguardando assinatura",
      descricao: "Acompanhe quem já assinou no card do contrato. Cancele o processo se precisar reabrir o pedido para edição.",
    };
  }
  return null;
}

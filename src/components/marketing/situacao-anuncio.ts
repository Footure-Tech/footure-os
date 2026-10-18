import {
  MdErrorOutline,
  MdPauseCircleOutline,
  MdPlayCircleOutline,
  MdTimerOff,
} from "react-icons/md";

/**
 * Situação de veiculação do anúncio (effective_status da Meta; EXPIRED é
 * gravado pela sincronização quando o conjunto ou a campanha já terminou).
 */
export function situacaoAnuncio(status: string | null) {
  if (!status) return null;
  if (status === "ACTIVE")
    return {
      rotulo: "Rodando",
      tom: "active",
      icone: MdPlayCircleOutline,
      parado: false,
    } as const;
  if (status === "EXPIRED")
    return {
      rotulo: "Expirado",
      tom: "pending",
      icone: MdTimerOff,
      parado: true,
    } as const;
  if (
    status.includes("PAUSED") ||
    status === "ARCHIVED" ||
    status === "DELETED"
  )
    return {
      rotulo:
        status === "CAMPAIGN_PAUSED"
          ? "Pausado (campanha)"
          : status === "ADSET_PAUSED"
            ? "Pausado (conjunto)"
            : "Pausado",
      tom: "not_started",
      icone: MdPauseCircleOutline,
      parado: true,
    } as const;
  const rotulo: Record<string, string> = {
    DISAPPROVED: "Reprovado",
    WITH_ISSUES: "Com problemas",
    PENDING_REVIEW: "Em análise",
    IN_PROCESS: "Em processamento",
    PENDING_BILLING_INFO: "Pagamento pendente",
  };
  return {
    rotulo: rotulo[status] ?? status.toLowerCase(),
    tom: "inactive",
    icone: MdErrorOutline,
    parado: false,
  } as const;
}

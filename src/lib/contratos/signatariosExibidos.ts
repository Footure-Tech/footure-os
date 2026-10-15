// Lista de signatários do contrato com o status de assinatura de cada um —
// usada na tela Negócio e no painel de Contratos (jurídico).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { buscarPedidoDetalhe } from "@/lib/pedidos/consultas";

type Supa = SupabaseClient<Database>;
type DetalhePedido = NonNullable<Awaited<ReturnType<typeof buscarPedidoDetalhe>>>;

/** nao_assinou = estava pendente quando o processo de assinatura foi encerrado (prazo/finalização). */
export type SituacaoSignatario = "assinado" | "pendente" | "recusado" | "nao_assinou" | "nao_enviado";

export interface SignatarioExibido {
  nome: string;
  /** Ex.: "Contratante · representante legal", "Testemunha · Footure". */
  papel: string;
  email?: string | null;
  situacao: SituacaoSignatario;
  assinadoEm?: string | null;
}

function papelSignatario(lado: "cliente" | "footure", representante: boolean) {
  if (lado === "cliente") return representante ? "Contratante · representante legal" : "Testemunha · contratante";
  return representante ? "Footure · representante" : "Testemunha · Footure";
}

/**
 * Status por signatário (0027). Sem linhas registradas = contrato ainda não
 * enviado, ou enviado antes da migration: monta a lista a partir dos
 * signatários do pedido e usa o status geral (todos aguardando / assinados).
 */
export async function carregarSignatariosExibidos(
  supabase: Supa,
  detalhe: DetalhePedido,
  contrato: { id: string; assinatura_incompleta: boolean } | null,
) {
  const { pedido, signatarios, representantesFooture, testemunhasFooture } = detalhe;
  const { data: linhas } = contrato
    ? await supabase.from("contrato_signatarios").select("*").eq("contrato_id", contrato.id).order("ordem")
    : { data: null };
  const incompleta = !!contrato?.assinatura_incompleta;
  const temStatusPorSignatario = !!linhas && linhas.length > 0;

  const situacaoGeral: SituacaoSignatario =
    pedido.status === "assinado" || pedido.status === "concluido"
      ? "assinado"
      : pedido.status === "enviado_para_assinatura"
        ? "pendente"
        : "nao_enviado";

  const lista: SignatarioExibido[] = temStatusPorSignatario
    ? linhas.map((s) => ({
        nome: s.nome,
        email: s.email,
        papel: papelSignatario(s.lado, s.papel === "legal_representative"),
        situacao: incompleta && s.status === "pendente" ? "nao_assinou" : s.status,
        assinadoEm: s.assinado_em,
      }))
    : [
        // Representantes legais do cliente antes das testemunhas.
        ...[...signatarios].sort((a, b) => Number(a.tipo !== "representante_legal") - Number(b.tipo !== "representante_legal")).map((s) => {
          const sc = s.signatarios_cliente as unknown as { nome_completo: string; email: string } | null;
          return {
            nome: sc?.nome_completo ?? "—",
            email: sc?.email,
            papel: papelSignatario("cliente", s.tipo === "representante_legal"),
            situacao: situacaoGeral,
          };
        }),
        ...representantesFooture.map((r) => {
          const rf = r.representantes_footure as unknown as { nome: string; email: string | null } | null;
          return { nome: rf?.nome ?? "—", email: rf?.email, papel: papelSignatario("footure", true), situacao: situacaoGeral };
        }),
        ...testemunhasFooture.map((t) => ({ nome: t.nome_completo, email: t.email, papel: papelSignatario("footure", false), situacao: situacaoGeral })),
      ];

  return {
    signatarios: lista,
    temStatusPorSignatario,
    assinados: lista.filter((s) => s.situacao === "assinado").length,
    naoAssinaram: lista.filter((s) => s.situacao === "nao_assinou"),
  };
}

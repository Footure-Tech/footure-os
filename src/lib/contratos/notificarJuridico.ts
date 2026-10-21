// Aviso por e-mail ao jurídico quando um contrato entra em validação
// (gerado na aprovação ou regenerado após rejeição). Usa o service client
// para ler os e-mails (auth.users) dos usuários ativos com papel "juridico";
// o escritório externo (DESTINATARIOS_JURIDICO_EXTERNO) vai sempre junto.
// Nunca lança — falha de e-mail não pode travar o fluxo do pedido.
import { createServiceClient } from "@/lib/supabase/service";
import { enviarEmailContratoParaValidacao } from "@/lib/integracoes/resend";
import { urlDoSistema } from "@/lib/email/layout";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { formatarMoeda } from "@/lib/formatacao";

/** Escritório de advocacia externo — recebe o aviso junto com o jurídico interno, sem ser usuário do sistema. */
const DESTINATARIOS_JURIDICO_EXTERNO = ["cadastro@sperottoadvogados.com.br"];

export async function notificarJuridicoContratoParaValidacao(pedidoId: string, motivo: string) {
  try {
    const service = createServiceClient();
    const [{ data: juridicos }, { data: pedido }, { data: contrato }] = await Promise.all([
      service.from("profiles").select("user_id").eq("papel", "juridico").eq("ativo", true),
      service.from("pedidos").select("plano, perfil, valor_total, clientes(razao_social, nome_fantasia)").eq("id", pedidoId).single(),
      service.from("contratos").select("versao").eq("pedido_id", pedidoId).order("versao", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!pedido) return;

    const internos = (
      await Promise.all((juridicos ?? []).map(async (j) => (await service.auth.admin.getUserById(j.user_id)).data.user?.email ?? null))
    ).filter((e): e is string => !!e);
    const emails = [...new Set([...internos, ...DESTINATARIOS_JURIDICO_EXTERNO])];

    const cliente = pedido.clientes as unknown as { razao_social: string; nome_fantasia: string | null } | null;
    await enviarEmailContratoParaValidacao(emails, {
      cliente: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
      plano: `${pedido.perfil === "clube" ? "Clube" : "Agente"} · ${buscarPlanoPorKey(pedido.plano)?.canonical ?? pedido.plano}`,
      valorTotal: formatarMoeda(pedido.valor_total),
      versao: contrato?.versao ?? 1,
      motivo,
      link: `${urlDoSistema()}/pedidos/${pedidoId}`,
    });
  } catch (erro) {
    console.error("[juridico] aviso de contrato para validação não enviado:", erro instanceof Error ? erro.message : erro);
  }
}

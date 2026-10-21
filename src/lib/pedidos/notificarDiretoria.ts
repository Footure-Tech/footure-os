// Aviso por e-mail à diretoria (papel "admin") quando um pedido entra em
// aprovação. Mesmo padrão do aviso ao jurídico (contratos/notificarJuridico.ts):
// service client para ler os e-mails em auth.users; nunca lança — falha de
// e-mail não pode travar o envio do pedido.
import { createServiceClient } from "@/lib/supabase/service";
import { enviarEmailPedidoParaAprovacao } from "@/lib/integracoes/resend";
import { urlDoSistema } from "@/lib/email/layout";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { formatarMoeda } from "@/lib/formatacao";
import { ROTULO_MEIO_PAGAMENTO } from "@/lib/contratos/meioPagamento";

export async function notificarDiretoriaPedidoParaAprovacao(pedidoId: string) {
  try {
    const service = createServiceClient();
    const [{ data: diretoria }, { data: pedido }] = await Promise.all([
      service.from("profiles").select("user_id").eq("papel", "admin").eq("ativo", true),
      service
        .from("pedidos")
        .select("plano, perfil, valor_total, valor_mensal, forma_pagamento, meio_pagamento, numero_parcelas, vendedor_id, clientes(razao_social, nome_fantasia)")
        .eq("id", pedidoId)
        .single(),
    ]);
    if (!diretoria?.length || !pedido) return;

    const emails = (
      await Promise.all(diretoria.map(async (d) => (await service.auth.admin.getUserById(d.user_id)).data.user?.email ?? null))
    ).filter((e): e is string => !!e);
    if (!emails.length) return;

    const { data: vendedor } = await service.from("profiles").select("nome").eq("user_id", pedido.vendedor_id).maybeSingle();
    const cliente = pedido.clientes as unknown as { razao_social: string; nome_fantasia: string | null } | null;
    const meio = ROTULO_MEIO_PAGAMENTO[pedido.meio_pagamento];
    await enviarEmailPedidoParaAprovacao(emails, {
      cliente: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
      plano: `${pedido.perfil === "clube" ? "Clube" : "Agente"} · ${buscarPlanoPorKey(pedido.plano)?.canonical ?? pedido.plano}`,
      valorTotal: formatarMoeda(pedido.valor_total),
      pagamento:
        pedido.forma_pagamento === "parcelado"
          ? `${meio} · ${pedido.numero_parcelas ?? "?"}x de ${formatarMoeda(pedido.valor_mensal)}`
          : `${meio} · à vista`,
      vendedor: vendedor?.nome ?? "O vendedor",
      link: `${urlDoSistema()}/pedidos/${pedidoId}`,
    });
  } catch (erro) {
    console.error("[diretoria] aviso de pedido para aprovação não enviado:", erro instanceof Error ? erro.message : erro);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PapelUsuario, StatusPedido } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

/** Chaves dos contadores da sidebar — cada link aponta pra no máximo uma. */
export type ChaveContador = "pedidosRascunho" | "aprovacao" | "contratos" | "inadimplentes";

export interface StatusIntegracoes {
  clicksignConfigurada: boolean;
  /** Última sincronização de contatos do Bling (null = nunca sincronizado). */
  blingSincronizadoEm: string | null;
}

export interface DadosShell {
  contadores: Partial<Record<ChaveContador, number>>;
  integracoes: StatusIntegracoes;
}

// Mesmos status da fila do jurídico (tela Contratos): contratos ainda não assinados.
const STATUS_CONTRATO_EM_ANDAMENTO: StatusPedido[] = ["em_revisao_juridica", "pronto_para_assinatura", "enviado_para_assinatura"];

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>, rotulo: string) {
  const { count, error } = await consulta;
  if (error) console.error(`[dadosShell] ${rotulo}:`, error.message);
  return count ?? 0;
}

/**
 * Contadores da sidebar e status das integrações, consultados com o client da
 * sessão (RLS vale — o vendedor só conta os próprios pedidos). Só busca os
 * contadores dos links que o papel enxerga.
 */
export async function obterDadosShell(supabase: Supa, papel: PapelUsuario, usuarioId: string): Promise<DadosShell> {
  const contadores: DadosShell["contadores"] = {};
  const tarefas: Promise<void>[] = [];

  if (papel === "vendedor") {
    tarefas.push(
      contar(
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("vendedor_id", usuarioId).eq("status", "rascunho"),
        "pedidosRascunho",
      ).then((n) => void (contadores.pedidosRascunho = n)),
    );
  }

  if (papel === "admin") {
    tarefas.push(
      Promise.all([
        contar(supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "em_aprovacao"), "emAprovacao"),
        contar(
          supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "aprovado").not("geracao_contrato_erro", "is", null),
          "aprovadosComErro",
        ),
      ]).then(([emAprovacao, comErro]) => void (contadores.aprovacao = emAprovacao + comErro)),
    );
  }

  if (papel === "juridico" || papel === "admin") {
    tarefas.push(
      contar(
        supabase.from("pedidos").select("id", { count: "exact", head: true }).in("status", STATUS_CONTRATO_EM_ANDAMENTO),
        "contratos",
      ).then((n) => void (contadores.contratos = n)),
    );
  }

  if (papel === "vendedor" || papel === "admin") {
    tarefas.push(
      contar(
        supabase.from("bling_contatos").select("id", { count: "exact", head: true }).eq("tem_parcela_atrasada", true),
        "inadimplentes",
      ).then((n) => void (contadores.inadimplentes = n)),
    );
  }

  const ultimaSincronizacao = supabase
    .from("bling_contatos")
    .select("sincronizado_em")
    .order("sincronizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: sincronizacao }] = await Promise.all([ultimaSincronizacao, ...tarefas]);

  return {
    contadores,
    integracoes: {
      clicksignConfigurada: !!process.env.CLICKSIGN_API_URL && !!process.env.CLICKSIGN_ACCESS_TOKEN,
      blingSincronizadoEm: sincronizacao?.sincronizado_em ?? null,
    },
  };
}

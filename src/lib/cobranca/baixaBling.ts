// Régua de cobrança — Fase 2: baixa automática no Bling dos boletos pagos no
// Banco Inter. Só boletos que o SISTEMA emitiu (origem 'sistema', fora de
// teste). Dispara no webhook do Inter e na conferência do cron das 9h; falha
// fica em baixa_bling_erro e é tentada de novo na próxima rodada.
//
// Conta (portador): cobranca_configuracao.bling_baixa_portador_id — "Caixa",
// a mesma das baixas manuais do financeiro. Categoria: a que a própria conta a
// receber já tem no Bling (Footlink Clubes, Agentes…). O que foi pago acima do
// valor da parcela (multa e juros do boleto) vai como juros.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { consultarBling, requisicaoBling } from "@/lib/integracoes/bling";
import { SITUACOES_BOLETO_PAGO } from "./boletos";
import { tokenBlingSeguro } from "./blingToken";
import { hojeBrt } from "./regras";

type Supa = SupabaseClient<Database>;

/** Situações de conta a receber no Bling que já não aceitam baixa: recebida, devolvida, cancelada. */
const CONTA_ENCERRADA = new Set([2, 4, 5]);

export interface ResultadoBaixas {
  baixados: number;
  jaBaixados: number;
  falhas: number;
  ignorado?: string;
}

export async function baixarBoletosPagos(supabase: Supa): Promise<ResultadoBaixas> {
  const r: ResultadoBaixas = { baixados: 0, jaBaixados: 0, falhas: 0 };
  const { data: config } = await supabase.from("cobranca_configuracao").select("bling_baixa_portador_id").eq("id", true).single();
  if (!config?.bling_baixa_portador_id) return { ...r, ignorado: "Conta da baixa no Bling não configurada." };
  const { data: boletos } = await supabase
    .from("cobranca_boletos")
    .select("*")
    .eq("origem", "sistema")
    .eq("teste", false)
    .in("situacao", SITUACOES_BOLETO_PAGO)
    .is("baixa_bling_em", null);
  if (!boletos?.length) return r;
  const token = await tokenBlingSeguro(supabase);
  if (!token) return { ...r, ignorado: "Token do Bling indisponível agora (sincronização em andamento) — fica para a próxima rodada." };

  for (const b of boletos) {
    try {
      const { data: conta } = await consultarBling<{ data: { situacao: number; categoria?: { id?: number } } }>(token, `/contas/receber/${b.parcela_id}`);
      if (CONTA_ENCERRADA.has(conta.situacao)) {
        // Baixada à mão (ou cancelada) antes do sistema: só registra, sem baixar de novo.
        await supabase.from("cobranca_boletos").update({ baixa_bling_em: new Date().toISOString(), baixa_bling_erro: "Já estava baixada no Bling." }).eq("id", b.id);
        r.jaBaixados++;
        continue;
      }
      const principal = Number(b.valor);
      const recebido = b.valor_recebido === null ? principal : Number(b.valor_recebido);
      const juros = Math.round(Math.max(0, recebido - principal) * 100) / 100;
      await requisicaoBling(token, "POST", `/contas/receber/${b.parcela_id}/baixar`, {
        data: b.recebido_em ?? hojeBrt(),
        usarDataVencimento: false,
        portador: { id: config.bling_baixa_portador_id },
        ...(conta.categoria?.id ? { categoria: { id: conta.categoria.id } } : {}),
        historico: `Recebimento Banco Inter · boleto nº ${b.nosso_numero ?? b.codigo_solicitacao} via ${b.origem_recebimento ?? "boleto"} · Footure OS`,
        valorRecebido: Math.min(principal, recebido),
        ...(juros > 0 ? { juros } : {}),
      });
      await supabase.from("cobranca_boletos").update({ baixa_bling_em: new Date().toISOString(), baixa_bling_erro: null }).eq("id", b.id);
      r.baixados++;
    } catch (e) {
      await supabase.from("cobranca_boletos").update({ baixa_bling_erro: e instanceof Error ? e.message.slice(0, 500) : String(e) }).eq("id", b.id);
      r.falhas++;
    }
  }
  return r;
}

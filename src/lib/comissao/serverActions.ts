"use server";

import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";

export interface ConfiguracaoComissionamentoInput {
  percentualImposto: number;
  percentualComissaoTotal: number;
  percentualComissaoSdr: number;
  percentualComissaoCloser: number;
}

function validarPercentual(valor: number, campo: string) {
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new Error(`${campo} precisa ser um número entre 0 e 100.`);
  }
}

export async function salvarConfiguracaoComissionamento(dados: ConfiguracaoComissionamentoInput): Promise<ResultadoAcao> {
  return executar(async () => {
    const sessao = await exigirPapel("admin");
    validarPercentual(dados.percentualImposto, "% de imposto");
    validarPercentual(dados.percentualComissaoTotal, "% de comissão total");
    validarPercentual(dados.percentualComissaoSdr, "% de comissão SDR");
    validarPercentual(dados.percentualComissaoCloser, "% de comissão Closer");

    const supabase = await createClient();
    const { error } = await supabase
      .from("configuracoes_comissionamento")
      .update({
        percentual_imposto: dados.percentualImposto,
        percentual_comissao_total: dados.percentualComissaoTotal,
        percentual_comissao_sdr: dados.percentualComissaoSdr,
        percentual_comissao_closer: dados.percentualComissaoCloser,
        atualizado_por: sessao.id,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/configuracoes");
  });
}

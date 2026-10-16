// Análise da nova versão enviada pelo jurídico (0041): compara o texto com a
// versão anterior (diffVersoes) e pede ao Claude um resumo de cada mudança e
// uma sugestão — "modelo" (melhoria que deveria valer para todos os contratos)
// ou "especifico" (ajuste deste cliente/negociação). O jurídico decide depois,
// na tela, o que agregar ao modelo. Sem ANTHROPIC_API_KEY, grava só a
// comparação. Nunca lança: falha vira status "erro" na análise.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { compararVersoes, type MudancaTexto } from "./diffVersoes";

type Supa = SupabaseClient<Database>;

/** Acima disso a IA analisa só as primeiras (a lista completa é gravada mesmo assim). */
const MAX_MUDANCAS_IA = 80;

const RespostaIA = z.object({
  resumo: z.string().describe("Resumo geral das mudanças, em 1 a 3 frases."),
  mudancas: z.array(
    z.object({
      indice: z.number().int().describe("Índice da mudança na lista recebida."),
      resumo: z.string().describe("O que mudou e o efeito prático, em 1 ou 2 frases."),
      sugestao: z.enum(["modelo", "especifico"]),
      motivo: z.string().describe("Por que essa sugestão, em uma frase."),
    }),
  ),
});

const SISTEMA = `Você apoia o jurídico da Footure na revisão de contratos de licença de uso do software Footlink.
O jurídico editou um contrato gerado pelo modelo padrão e enviou uma nova versão. Você recebe a lista das diferenças de texto entre a versão anterior e a nova.

Para cada diferença:
- resumo: diga em português, de forma direta, o que mudou e o efeito prático (1 ou 2 frases).
- sugestao: "modelo" quando a mudança é genérica e faria sentido em todos os contratos deste modelo (correção de redação, ortografia, cláusula de proteção nova, ajuste de termo jurídico); "especifico" quando depende deste cliente ou desta negociação (nome, CNPJ, endereço, representantes, valores, datas, prazos, quantidades, condições comerciais negociadas).
- Quando o trecho contém qualquer dado do cliente ou valor negociado, a sugestão é "especifico", mesmo que a redação também tenha mudado.
- Na dúvida, use "especifico" — uma mudança marcada como "modelo" pode ser aplicada a todos os contratos futuros.
- motivo: uma frase explicando a sugestão.
Responda também com um resumo geral das mudanças.`;

function descreverMudancas(mudancas: MudancaTexto[]) {
  return mudancas
    .map((m, i) => {
      const linhas = [`[${i}] ${m.tipo.toUpperCase()}${m.clausula ? ` — ${m.clausula}` : ""}`];
      if (m.tipo !== "incluido") linhas.push(`ANTES: ${m.trechoOriginal}`);
      if (m.tipo !== "removido") linhas.push(`DEPOIS: ${m.trechoNovo}`);
      return linhas.join("\n");
    })
    .join("\n\n");
}

async function analisarComIA(perfil: string, mudancas: MudancaTexto[]) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const lote = mudancas.slice(0, MAX_MUDANCAS_IA);
  const resposta = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Fallback no servidor em caso de recusa por política (padrão recomendado para este modelo).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(RespostaIA) },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content: `Modelo de contrato: Footlink ${perfil === "clube" ? "Clube" : "Agente"}.\n${
          mudancas.length > lote.length ? `(Há ${mudancas.length} diferenças; abaixo, as primeiras ${lote.length}.)\n` : ""
        }\n${descreverMudancas(lote)}`,
      },
    ],
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return null;
  return resposta.parsed_output;
}

export async function analisarNovaVersao(supabase: Supa, pedidoId: string, contratoId: string, versao: number) {
  const { data: analise, error: erroAnalise } = await supabase
    .from("contrato_analises")
    .insert({ contrato_id: contratoId })
    .select("id")
    .single();
  if (erroAnalise || !analise) {
    console.error("[contrato] análise da versão não iniciada:", erroAnalise?.message);
    return;
  }
  const falhar = async (erro: string) => {
    await supabase.from("contrato_analises").update({ status: "erro", erro }).eq("id", analise.id);
  };

  try {
    const [{ data: base }, { data: nova }, { data: pedido }] = await Promise.all([
      supabase.from("contratos").select("id, arquivo_path").eq("pedido_id", pedidoId).eq("versao", versao - 1).maybeSingle(),
      supabase.from("contratos").select("arquivo_path").eq("id", contratoId).single(),
      supabase.from("pedidos").select("perfil").eq("id", pedidoId).single(),
    ]);
    if (!base || !nova) return falhar("Não há versão anterior para comparar.");
    await supabase.from("contrato_analises").update({ base_contrato_id: base.id }).eq("id", analise.id);

    const baixar = async (path: string) => {
      const { data, error } = await supabase.storage.from("contratos").download(path);
      if (error || !data) throw new Error(`Falha ao ler ${path}: ${error?.message}`);
      return Buffer.from(await data.arrayBuffer());
    };
    const mudancas = await compararVersoes(await baixar(base.arquivo_path), await baixar(nova.arquivo_path));
    if (mudancas.length === 0) {
      await supabase.from("contrato_analises").update({ status: "concluida", resumo: "Nenhuma diferença de texto em relação à versão anterior." }).eq("id", analise.id);
      return;
    }

    let ia: Awaited<ReturnType<typeof analisarComIA>> = null;
    try {
      ia = await analisarComIA(pedido?.perfil ?? "clube", mudancas);
    } catch (erro) {
      console.error("[contrato] resumo por IA indisponível:", erro instanceof Error ? erro.message : erro);
    }
    const porIndice = new Map((ia?.mudancas ?? []).map((m) => [m.indice, m]));

    const { error: erroMudancas } = await supabase.from("contrato_mudancas").insert(
      mudancas.map((m, i) => ({
        analise_id: analise.id,
        ordem: i,
        clausula: m.clausula,
        tipo: m.tipo,
        trecho_original: m.trechoOriginal,
        trecho_novo: m.trechoNovo,
        resumo: porIndice.get(i)?.resumo ?? null,
        sugestao: porIndice.get(i)?.sugestao ?? null,
        motivo_sugestao: porIndice.get(i)?.motivo ?? null,
      })),
    );
    if (erroMudancas) return falhar(`Falha ao gravar as mudanças: ${erroMudancas.message}`);

    await supabase
      .from("contrato_analises")
      .update({
        status: "concluida",
        resumo: ia?.resumo ?? `${mudancas.length} ${mudancas.length === 1 ? "diferença encontrada" : "diferenças encontradas"} em relação à versão anterior.`,
        resumo_ia: !!ia,
      })
      .eq("id", analise.id);
  } catch (erro) {
    await falhar(erro instanceof Error ? erro.message : String(erro));
  }
}

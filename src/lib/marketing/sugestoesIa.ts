// "Sugestões por IA" de uma campanha (Marketing · detalhe da campanha): uma
// chamada ao Claude por clique da Diretoria, com os números da campanha no
// período, o resultado das regras (motor.ts) por criativo, as ressalvas de
// atribuição e as imagens dos 6 criativos com mais gasto. A resposta tem
// formato fixo (diagnóstico, leitura dos criativos, conceitos novos,
// hipóteses de teste, alertas de dados) e é gravada em mkt_sugestoes_ia com
// os tokens e o custo — base do consumo mostrado na tela. As regras
// determinísticas continuam sendo a base da decisão; a IA é interpretação e
// criatividade, para validação humana.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { carregarCriativos, carregarDesempenho, ROTULO_BU, type PeriodoMarketing } from "./consultas";

type Supa = SupabaseClient<Database>;

export const MODELO_SUGESTOES = "claude-opus-5-5";
/** Criativos (com mais gasto) cujas imagens vão para a IA — controla os tokens. */
const MAX_IMAGENS = 6;

/** US$ por milhão de tokens (entrada, saída). O pensamento conta como saída. Fallback do servidor pode trocar o modelo. */
const PRECO_POR_MTOK: Array<[RegExp, number, number]> = [
  [/opus-5-5/, 4, 20],
  [/opus/, 5, 25],
  [/sonnet/, 2, 10],
  [/fable|mythos/, 10, 50],
  [/haiku/, 0.1, 0.5],
];
export function custoUsd(modelo: string, entrada: number, saida: number) {
  const [, pe, ps] = PRECO_POR_MTOK.find(([r]) => r.test(modelo)) ?? PRECO_POR_MTOK[0];
  return (entrada * pe + saida * ps) / 1_000_000;
}

export const RespostaSugestoes = z.object({
  diagnostico: z.string().describe("O que está acontecendo na campanha, em 3 a 5 frases diretas, com os números que sustentam a leitura."),
  leituraCriativos: z.object({
    resumo: z.string().describe("Leitura geral das peças: o que separa as que convertem das que não convertem, em 2 a 4 frases."),
    oQueFunciona: z.array(z.string()).describe("Elementos (visuais e de mensagem) presentes nas peças que performam melhor."),
    oQueFalta: z.array(z.string()).describe("O que falta ou atrapalha nas peças que performam pior."),
  }),
  conceitos: z
    .array(
      z.object({
        titulo: z.string(),
        gancho: z.string().describe("A primeira frase/visual que prende a atenção."),
        mensagem: z.string().describe("A mensagem principal da peça."),
        visual: z.string().describe("Composição e elementos visuais sugeridos."),
        chamada: z.string().describe("Chamada para ação."),
        baseadoEm: z.string().describe("Em qual peça ou dado da campanha o conceito se apoia."),
      }),
    )
    .describe("2 a 3 conceitos de criativo novo."),
  testes: z
    .array(
      z.object({
        hipotese: z.string(),
        como: z.string().describe("Como testar (ex.: duplicar o conjunto, trocar a peça, público)."),
        metrica: z.string().describe("Qual métrica observar e o que indicaria sucesso."),
      }),
    )
    .describe("2 a 4 hipóteses de teste."),
  alertas: z.array(z.string()).describe("Onde os dados são frágeis e a conclusão deve ser lida com cautela."),
});
export type ResultadoSugestoes = z.infer<typeof RespostaSugestoes>;

const SISTEMA = `Você apoia o time de marketing da Footure (Footure Academy: cursos de futebol; Footlink: software para clubes e agentes) na gestão de mídia paga na Meta (Facebook/Instagram).
Você recebe os números de UMA campanha num período, o resultado de um motor de regras por criativo (ESCALAR/MANTER/REVISAR/PAUSAR/OBSERVAR — já calculado, não refaça) e as imagens dos principais criativos.

Seu papel é interpretar e propor, nunca decidir:
- Diagnóstico: o que está acontecendo, citando os números que sustentam a leitura.
- Leitura dos criativos: compare as imagens das peças que convertem com as que não convertem (gancho, oferta, prova, chamada, composição, texto na arte). Seja concreto sobre o que se vê.
- 2 a 3 conceitos de criativo novo, apoiados no que funcionou.
- 2 a 4 hipóteses de teste, com como testar e qual métrica observar.
- Alertas de dados.

Regras importantes:
- A atribuição é PARCIAL: só uma parte das vendas chega ao CRM com campanha/anúncio. O ROAS é parcial e o CAC é um teto. Com cobertura baixa (abaixo de 50%) ou poucas vendas (menos de 3), NÃO trate ROAS/CAC como conclusão firme — diga isso nos alertas e prefira sinais de topo de funil (CPL, frequência, tendência de CPL, MQL).
- Criativos "jovens" têm leads recentes demais para julgar venda.
- Leads "recuperados por nome" são atribuição fraca.
- Use linguagem de observação quando a amostra for pequena; não invente números que não estão nos dados.
- Escreva em português do Brasil, direto, para um gestor de marketing.`;

const moeda = (v: number | null) => (v === null ? "—" : `R$ ${v.toFixed(2).replace(".", ",")}`);

/** Gera uma rodada de sugestões e grava em mkt_sugestoes_ia. Lança erro com mensagem legível. */
export async function gerarSugestoesIa(supabase: Supa, chaveCampanha: string, periodo: Extract<PeriodoMarketing, "30d" | "90d">, usuarioId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  const carregado = await carregarCriativos(supabase, chaveCampanha, periodo);
  if (!carregado) throw new Error("Campanha não encontrada.");
  const dados = carregado;
  if (!dados.criativos.length) throw new Error("A campanha não tem criativos com dados no período.");
  const desempenho = await carregarDesempenho(supabase, { periodo, bu: dados.campanha.bu, campanha: null });

  const soma = (f: (c: (typeof dados.criativos)[number]) => number) => dados.criativos.reduce((s, c) => s + f(c), 0);
  const gasto = soma((c) => c.gasto);
  const entrada = {
    campanha: dados.campanha.nome,
    bu: ROTULO_BU[dados.campanha.bu],
    periodo: { de: dados.de, ate: dados.ate },
    totais: {
      investimento: Math.round(gasto * 100) / 100,
      leadsMeta: Math.round(soma((c) => c.leadsMeta)),
      leadsCrm: soma((c) => c.leads),
      mql: soma((c) => c.mql),
      vendas: soma((c) => c.vendas),
      receitaAtribuida: Math.round(soma((c) => c.receita) * 100) / 100,
    },
    atribuicao: {
      coberturaDaBu: desempenho.cobertura.taxa === null ? null : `${Math.round(desempenho.cobertura.taxa * 100)}% (${desempenho.cobertura.vendasAtribuidas} de ${desempenho.cobertura.vendasTotais} vendas do CRM têm campanha)`,
      medianaDiasLeadAteVenda: Math.round(dados.medianaDias * 10) / 10,
    },
    recomendacoesDasRegras: dados.recomendacoes.map((r) => `${r.titulo}: ${r.texto}`),
    criativos: dados.criativos.map((c, i) => ({
      ordem: i + 1,
      nome: c.nome,
      acaoDasRegras: c.acao,
      porQue: c.motivo,
      gasto: moeda(c.gasto),
      leadsMeta: Math.round(c.leadsMeta),
      leadsCrm: c.leads,
      leadsMaduros: c.leadsMaduros,
      mql: c.mql,
      vendas: c.vendas,
      receita: c.vendas ? moeda(c.receita) : null,
      roas: c.roas === null || !c.vendas ? null : Math.round(c.roas * 100) / 100,
      frequencia: c.frequencia === null ? null : Math.round(c.frequencia * 100) / 100,
      cplPrimeiraMetade: moeda(c.cplIni),
      cplSegundaMetade: moeda(c.cplFim),
      saturando: c.saturando ? c.motivoSaturacao : null,
      jovem: c.jovem,
      leadsRecuperadosPorNome: c.recuperados,
    })),
  };

  // Imagens dos criativos com mais gasto (a lista vem ordenada por ação; aqui, por gasto).
  const comImagem = [...dados.criativos].filter((c) => c.imagemUrl).sort((a, b) => b.gasto - a.gasto).slice(0, MAX_IMAGENS);
  const blocosImagem: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const c of comImagem) {
    const resposta = await fetch(c.imagemUrl!);
    if (!resposta.ok) continue;
    const tipo = (resposta.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(tipo)) continue;
    blocosImagem.push({ type: "text", text: `Imagem do criativo ${dados.criativos.indexOf(c) + 1} — "${c.nome}" (ação das regras: ${c.acao}):` });
    blocosImagem.push({
      type: "image",
      source: { type: "base64", media_type: tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: Buffer.from(await resposta.arrayBuffer()).toString("base64") },
    });
  }

  const client = new Anthropic();
  const resposta = await client.beta.messages.parse({
    model: MODELO_SUGESTOES,
    max_tokens: 16000,
    // Fallback no servidor em caso de recusa por política (padrão recomendado para este modelo).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(RespostaSugestoes) },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Dados da campanha (JSON):\n${JSON.stringify(entrada, null, 2)}` },
          ...blocosImagem,
          { type: "text", text: "Gere as sugestões no formato pedido." },
        ],
      },
    ],
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) throw new Error("A IA não devolveu sugestões para esta campanha. Tente de novo mais tarde.");

  const u = resposta.usage;
  const tokensEntrada = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const tokensSaida = u.output_tokens ?? 0;
  const { data, error } = await supabase
    .from("mkt_sugestoes_ia")
    .insert({
      campanha_chave: chaveCampanha,
      campanha_nome: dados.campanha.nome,
      periodo,
      periodo_de: dados.de,
      periodo_ate: dados.ate,
      modelo: resposta.model,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      custo_usd: Math.round(custoUsd(resposta.model, tokensEntrada, tokensSaida) * 10000) / 10000,
      entrada: { ...entrada, imagensEnviadas: comImagem.map((c) => c.nome) },
      resultado: resposta.parsed_output,
      criado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Sugestões geradas, mas não foi possível gravar: ${error?.message}`);
  return data.id;
}

export interface RodadaSugestoes<R = ResultadoSugestoes> {
  id: string;
  criadoEm: string;
  autor: string | null;
  periodo: "30d" | "90d" | "tudo";
  de: string;
  ate: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  imagens: string[];
  resultado: R;
}

/**
 * Histórico de rodadas de uma campanha (mais recente primeiro) e o consumo
 * das sugestões no sistema (criativos + funil). `tipo`: as Sugestões da aba
 * Criativos ou as Estratégias da aba Funil (0056).
 */
export async function carregarSugestoesIa<R = ResultadoSugestoes>(supabase: Supa, chaveCampanha: string, tipo: "criativos" | "funil" = "criativos") {
  const inicioMes = `${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7)}-01`;
  const [{ data: rodadas }, { data: todas }, { data: perfis }] = await Promise.all([
    supabase.from("mkt_sugestoes_ia").select("*").eq("campanha_chave", chaveCampanha).eq("tipo", tipo).order("criado_em", { ascending: false }),
    supabase.from("mkt_sugestoes_ia").select("custo_usd, criado_em"),
    supabase.from("profiles").select("user_id, nome"),
  ]);
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  const custos = (todas ?? []).map((r) => ({ custo: Number(r.custo_usd), data: r.criado_em }));
  return {
    rodadas: (rodadas ?? []).map(
      (r): RodadaSugestoes<R> => ({
        id: r.id,
        criadoEm: r.criado_em,
        autor: r.criado_por ? (nome.get(r.criado_por) ?? null) : null,
        periodo: r.periodo,
        de: r.periodo_de,
        ate: r.periodo_ate,
        modelo: r.modelo,
        tokensEntrada: r.tokens_entrada,
        tokensSaida: r.tokens_saida,
        custoUsd: Number(r.custo_usd),
        imagens: ((r.entrada as { imagensEnviadas?: string[] } | null)?.imagensEnviadas ?? []) as string[],
        resultado: r.resultado as R,
      }),
    ),
    // Última rodada com menos de 7 dias: gerar outra pede confirmação.
    recenteId: rodadas?.[0] && Date.now() - Date.parse(rodadas[0].criado_em) < 7 * 86_400_000 ? rodadas[0].id : null,
    consumo: {
      mes: custos.filter((c) => c.data >= inicioMes).reduce((s, c) => s + c.custo, 0),
      total: custos.reduce((s, c) => s + c.custo, 0),
      rodadas: custos.length,
    },
  };
}

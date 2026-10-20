// "Estratégias por IA" da aba Funil (F4): uma chamada ao Claude por clique,
// com o funil da campanha no período (passagens × média da BU, diagnóstico do
// gargalo, perdas por motivo, conexão e velocidade, qualidade por criativo e
// público, origem) e as notas dos vendedores no Kommo. Devolve leitura do
// funil, objeções e como quebrá-las, roteiro de abordagem no WhatsApp,
// ajustes de campanha, ações comerciais e perguntas de qualificação para o
// formulário. Gravada em mkt_sugestoes_ia (tipo 'funil', 0056) com tokens e
// custo, como as Sugestões por IA dos criativos. Para validação humana.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buscarNotasLeadsKommo } from "@/lib/integracoes/kommo";
import { ROTULO_BU, type PeriodoMarketing } from "./consultas";
import { carregarFunil, type LinhaQualidade } from "./consultasFunil";
import { ROTULO_ESTAGIO } from "./funil";
import { custoUsd, MODELO_SUGESTOES } from "./sugestoesIa";

type Supa = SupabaseClient<Database>;

/** Notas mais recentes enviadas à IA (e o tamanho de cada uma) — controla os tokens. */
const MAX_NOTAS = 150;
const MAX_CARACTERES_NOTA = 400;

export const RespostaEstrategias = z.object({
  leitura: z.string().describe("Onde o funil da campanha trava e por quê, em 3 a 5 frases diretas, com os números que sustentam a leitura."),
  gargalos: z
    .array(
      z.object({
        etapa: z.string().describe("Passagem do funil (ex.: conexão, qualificação, fechamento)."),
        causa: z.string().describe("Causa provável."),
        evidencia: z.string().describe("Números ou notas que sustentam a causa."),
      }),
    )
    .describe("1 a 3 gargalos, do mais grave ao menos grave."),
  objecoes: z
    .array(
      z.object({
        objecao: z.string().describe("A objeção, como o lead diria."),
        sinais: z.string().describe("De onde ela aparece nos dados: motivos de perda, notas dos vendedores, etapa em que os leads param."),
        comoQuebrar: z.string().describe("Argumento e prova para responder a objeção."),
        mensagemExemplo: z.string().describe("Mensagem pronta para o WhatsApp, curta e no tom de conversa."),
      }),
    )
    .describe("3 a 6 objeções, das mais frequentes para as menos."),
  abordagem: z.object({
    primeiraMensagem: z.string().describe("Primeira mensagem humana depois da automática, pronta para o WhatsApp."),
    cadencia: z
      .array(z.object({ quando: z.string().describe("Ex.: 'até 1 h após o lead', 'D+1 de manhã'."), mensagem: z.string() }))
      .describe("3 a 5 tentativas para quem não respondeu, com o momento e a mensagem."),
    perguntasDescoberta: z.array(z.string()).describe("3 a 5 perguntas para o vendedor qualificar o lead na conversa."),
  }),
  ajustesCampanha: z
    .array(
      z.object({
        onde: z.enum(["publico", "criativo", "pagina", "oferta"]),
        acao: z.string(),
        porQue: z.string(),
      }),
    )
    .describe("2 a 4 ajustes na campanha, ligados ao gargalo."),
  acoesComerciais: z
    .array(
      z.object({
        acao: z.string(),
        quem: z.enum(["sdr", "closer", "gestao", "marketing"]),
        impacto: z.string().describe("O que deve melhorar e qual número acompanhar."),
      }),
    )
    .describe("2 a 4 ações do time comercial."),
  perguntasFormulario: z
    .array(
      z.object({
        pergunta: z.string(),
        opcoes: z.array(z.string()).describe("Opções fechadas (lista), para dar para segmentar."),
        porQue: z.string().describe("Que problema do funil a pergunta ajuda a resolver."),
      }),
    )
    .describe("2 a 3 perguntas de qualificação para o formulário da página, gravadas no Kommo."),
  alertas: z.array(z.string()).describe("Onde os dados são frágeis e a conclusão deve ser lida com cautela."),
});
export type ResultadoEstrategias = z.infer<typeof RespostaEstrategias>;

const SISTEMA = `Você apoia o time de marketing e o time comercial da Footure (Footure Academy: cursos de futebol; Footlink: software para clubes e agentes). Os leads chegam por anúncios na Meta, caem no CRM (Kommo) e são atendidos pelo WhatsApp.
Você recebe o funil de UMA campanha num período, da impressão à venda, e as notas que os vendedores deixam nos leads.

Como ler os dados:
- Safra: leads criados no período. Cada lead conta no maior estágio por onde passou (entrada → tentativa de contato → conectado → qualificado → reunião/oferta → negociação → ganho).
- Cada passagem traz a taxa da campanha e a média de todas as campanhas da mesma BU no período. O diagnóstico de gargalo já foi calculado por regras — use-o como ponto de partida, não refaça a conta.
- Conexão: a primeira mensagem enviada no WhatsApp costuma ser automática (~6 min). A velocidade do time é medida da primeira resposta do lead até a mensagem seguinte da Footure. A tabela de conversão por tempo de resposta mostra quanto a velocidade pesa.
- Motivos de perda são escolhidos pelo vendedor; "sem motivo" é perda sem registro.
- Notas são texto livre e esparso dos vendedores (nem todo lead tem). Cada nota vem com o estágio e o desfecho do lead. Elas são a melhor fonte de objeções reais: preço, momento do cartão, quem paga (empresa/chefe), perfil, tempo.
- O rastreio é parcial: parte dos leads da Meta chega ao Kommo sem a campanha.

Seu papel é interpretar e propor, nunca decidir:
- Leitura do funil e gargalos, citando os números.
- Objeções com como quebrá-las e uma mensagem de WhatsApp pronta. Só traga objeções que apareçam nos dados (motivos, notas ou padrão do funil) e diga onde aparecem.
- Roteiro de abordagem: primeira mensagem humana, cadência para quem não responde e perguntas de descoberta.
- Ajustes de campanha (público, criativo, página, oferta) ligados ao gargalo.
- Ações para o time comercial.
- 2 a 3 perguntas de qualificação para o formulário da página, com opções fechadas.
- Alertas onde a amostra é pequena ou o dado é frágil.

Regras:
- Não invente números que não estão nos dados; com amostra pequena, use linguagem de hipótese.
- Mensagens de WhatsApp curtas, em tom de conversa, sem exagero de emojis, sem prometer o que o produto não entrega.
- Escreva em português do Brasil, direto, para gestores de marketing e de vendas.`;

/** Tira e-mail, telefone e CPF das notas antes de enviar à IA. */
function semDadosPessoais(texto: string) {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[cpf]")
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, "[telefone]")
    .replace(/\s+/g, " ")
    .trim();
}

/** Linha de qualidade sem a chave interna (id do anúncio / nome do conjunto). */
const semChave = (q: LinhaQualidade) => ({ nome: q.nome, gasto: Math.round(q.gasto), leads: q.leads, conectado: q.conectado, qualificado: q.qualificado, vendas: q.vendas, perdidos: q.perdidos, foraDoPerfil: q.foraDoPerfil, faltaConexao: q.faltaConexao });

const arredondar = (v: number | null, casas = 3) => (v === null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

/** Gera uma rodada de estratégias e grava em mkt_sugestoes_ia (tipo 'funil'). Lança erro com mensagem legível. */
export async function gerarEstrategiasFunil(supabase: Supa, chaveCampanha: string, periodo: Extract<PeriodoMarketing, "30d" | "90d" | "tudo">, usuarioId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  const funil = await carregarFunil(supabase, chaveCampanha, periodo);
  if (!funil) throw new Error("Campanha não encontrada.");
  if (!funil.contagem.leads) throw new Error("A campanha não tem leads no Kommo neste período.");
  const { data: nome } = await supabase.from("mkt_meta_campanha_dia").select("campaign_name").eq("campaign_id", chaveCampanha.split(":")[1]).limit(1).maybeSingle();
  const campanhaNome = nome?.campaign_name ?? chaveCampanha;

  // Notas dos vendedores (as mais recentes), com o estágio e o desfecho do lead.
  const lead = new Map(funil.leadsDaSafra.map((l) => [l.leadId, l]));
  const notas = (await buscarNotasLeadsKommo([...lead.keys()]))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .slice(0, MAX_NOTAS)
    .map((n) => {
      const l = lead.get(n.lead_id)!;
      return {
        estagio: l.estagio ? ROTULO_ESTAGIO[l.estagio] : "Sem estágio",
        desfecho: l.desfecho,
        motivoDaPerda: l.motivo,
        nota: semDadosPessoais(n.texto).slice(0, MAX_CARACTERES_NOTA),
      };
    });

  const entrada = {
    campanha: campanhaNome,
    bu: ROTULO_BU[funil.bu],
    periodo: { de: funil.de, ate: funil.ate },
    safraImatura: funil.safraImatura,
    leads: funil.contagem,
    custo: { porLead: arredondar(funil.custo.porLead, 2), porQualificado: arredondar(funil.custo.porQualificado, 2), porQualificadoBu: arredondar(funil.custo.porQualificadoBu, 2), porVenda: arredondar(funil.custo.porVenda, 2) },
    funil: funil.passos.map((p) => ({ passo: p.rotulo, fonte: p.fonte, valor: Math.round(p.valor), taxa: arredondar(p.taxa), taxaMediaBu: arredondar(p.taxaBu) })),
    diagnosticoDasRegras: funil.cartoes.map((c) => ({ hipotese: c.titulo, situacao: c.situacao, gargalo: c.gargalo, evidencias: c.evidencias })),
    perdasPorMotivo: funil.perdas.map((p) => ({ motivo: p.nome, perdidos: p.total, parteDasPerdas: arredondar(p.parte), mediaBu: arredondar(p.parteBu), antesDeConectar: p.onde.antes, depoisDeConectar: p.onde.conectado, depoisDeQualificar: p.onde.qualificado })),
    conexao: {
      campanha: { ...funil.conexao.campanha, faixas: undefined },
      mediaBu: { taxaResposta: funil.conexao.bu.taxaResposta, tempoTimeMin: funil.conexao.bu.tempoTimeMin, respondidosAte1h: funil.conexao.bu.respondidosAte1h },
      conversaoPorTempoDeResposta: funil.conexao.campanha.faixas.map((f) => ({ faixa: f.rotulo, leads: f.leads, qualificados: f.qualificados, vendas: f.vendas })),
      leadsParados: funil.conexao.parados.length,
    },
    qualidade: {
      criativos: funil.qualidade.criativos.slice(0, 10).map(semChave),
      publicos: funil.qualidade.publicos.slice(0, 10).map(semChave),
    },
    origem: funil.origem,
    notasDosVendedores: notas,
  };

  const client = new Anthropic();
  const resposta = await client.beta.messages.parse({
    model: MODELO_SUGESTOES,
    max_tokens: 16000,
    // Fallback no servidor em caso de recusa por política (padrão recomendado para este modelo).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(RespostaEstrategias) },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content: `Funil da campanha (JSON):\n${JSON.stringify(entrada, null, 2)}\n\nGere as estratégias no formato pedido.`,
      },
    ],
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) throw new Error("A IA não devolveu estratégias para esta campanha. Tente de novo mais tarde.");

  const u = resposta.usage;
  const tokensEntrada = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const tokensSaida = u.output_tokens ?? 0;
  const { data, error } = await supabase
    .from("mkt_sugestoes_ia")
    .insert({
      campanha_chave: chaveCampanha,
      campanha_nome: campanhaNome,
      tipo: "funil",
      periodo,
      periodo_de: funil.de,
      periodo_ate: funil.ate,
      modelo: resposta.model,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      custo_usd: Math.round(custoUsd(resposta.model, tokensEntrada, tokensSaida) * 10000) / 10000,
      entrada: { ...entrada, notasEnviadas: notas.length },
      resultado: resposta.parsed_output,
      criado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Estratégias geradas, mas não foi possível gravar: ${error?.message}`);
  return data.id;
}

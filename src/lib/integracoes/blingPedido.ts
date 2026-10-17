// Envio do pedido de venda aprovado para o Bling (POST /pedidos/vendas) —
// substitui o Pluga, que criava esses pedidos a partir do sistema antigo.
// Segue o padrão que os pedidos do Pluga deixavam no Bling (confirmado contra
// pedidos reais, out/2026):
//   • um item por produto, quantidade = nº de parcelas, valor = parcela;
//   • categoria de receita por perfil (clubes/agentes);
//   • forma de pagamento do Banco Inter (boleto, pix, transferência) ou
//     Pagar.me Nx no cartão (uma parcela só, com o total);
//   • observações internas "Obs Pagamento / E-mail financeiro";
//   • contas a receber lançadas e pedido em "Atendido".
// Produto: um produto FIXO por plano, encontrado pelo nome padrão
// (nomeProdutoBling) e criado automaticamente na primeira venda do plano
// (exige o escopo "Produtos" no app do Bling). Idempotente: com bling_pedido_id já gravado, não cria de
// novo, só refaz as etapas seguintes (contas e situação).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buscarPlanoPorKey } from "@/lib/plans/normalize";
import { gerarParcelas } from "@/lib/contratos/parcelas";
import { formatarMoeda } from "@/lib/formatacao";
import { ROTULO_ORIGEM_VENDA, ROTULO_TIPO_VENDA } from "@/lib/vendas/rotulos";
import { consultarBling, obterAccessTokenValido, requisicaoBling } from "./bling";

type Supa = SupabaseClient<Database>;
type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];

/** Categorias de receita usadas pelos pedidos do Footlink no Bling. */
const CATEGORIA_POR_PERFIL = { clube: 14674069509, agente: 14674069511 } as const;

/** Formas de pagamento (Banco Inter; cartão = Pagar.me Nx). */
const FORMA_PAGAMENTO = { boleto: 4911256, pix: 4911553, transferencia_bancaria: 4912516 } as const;
const CARTAO_PAGARME: Record<number, number> = {
  1: 7547394,
  2: 7547401,
  3: 7547405,
  4: 7547409,
  5: 7547410,
  6: 7547413,
  7: 7547414,
  8: 7547415,
  9: 7547418,
  10: 7547419,
  11: 7547422,
  12: 7547375,
};

/** Situação "Atendido" do pedido de venda (padrão do Bling; é a dos pedidos do Pluga). */
const SITUACAO_ATENDIDO = 9;

/** Nome do produto no Bling para o plano — precisa existir lá com este nome exato. */
export function nomeProdutoBling(perfil: "clube" | "agente", planoKey: string): string {
  // Licenças especiais (ex.: "clube:feminino") não estão na escada de planos — usa o nome da chave.
  const semPrefixo = planoKey.includes(":") ? planoKey.split(":")[1] : planoKey;
  const plano = buscarPlanoPorKey(planoKey)?.canonical ?? semPrefixo.charAt(0).toUpperCase() + semPrefixo.slice(1).replace(/-/g, " ");
  return `Footlink ${perfil === "clube" ? "Clubes" : "Agentes"} - ${plano}`;
}
export const NOME_PRODUTO_API = "Footlink - API";

/** Código do produto no padrão dos já existentes (ex.: FKCLFM00): FK + CL/AG + iniciais do plano. */
function codigoProduto(nome: string): string {
  const [, linha = "", plano = ""] = nome.match(/^Footlink (Clubes|Agentes) - (.+)$/) ?? [];
  const prefixo = linha === "Agentes" ? "FKAG" : linha === "Clubes" ? "FKCL" : "FK";
  const iniciais = plano
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p.slice(0, 3).toUpperCase())
    .join("");
  return `${prefixo}${iniciais || nome.replace(/\W/g, "").slice(0, 8).toUpperCase()}`.slice(0, 20);
}

/**
 * Produto do plano no Bling, pelo nome exato. Se não existir, cria (serviço,
 * ativo, preço 0 — mesmo formato de "Footlink Clubes - Feminino") — exige o
 * escopo "Produtos" (gravação) no app do Bling; sem ele, erro com a orientação.
 */
async function buscarProduto(token: string, nome: string): Promise<{ id: number; codigo: string | null }> {
  const { data } = await consultarBling<{ data: Array<{ id: number; nome: string; codigo?: string; situacao?: string }> }>(
    token,
    `/produtos?nome=${encodeURIComponent(nome)}&limite=100`,
  );
  const alvo = nome.trim().toLowerCase();
  const exatos = (data ?? []).filter((p) => p.nome.trim().toLowerCase() === alvo);
  const produto = exatos.find((p) => p.situacao === "A") ?? exatos[0];
  if (produto) return { id: produto.id, codigo: produto.codigo || null };

  const codigo = codigoProduto(nome);
  try {
    const criado = await requisicaoBling<{ data: { id: number } }>(token, "POST", "/produtos", {
      nome,
      codigo,
      tipo: "S",
      formato: "S",
      situacao: "A",
      preco: 0,
    });
    if (!criado?.data?.id) throw new Error("o Bling não devolveu o id do produto");
    return { id: criado.data.id, codigo };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    if (/insufficient_scope|403/.test(msg)) {
      throw new Error(
        `Produto "${nome}" não existe no Bling e o app não tem permissão para criá-lo — inclua o escopo "Produtos" no app do Bling e reconecte, ou cadastre o produto com esse nome exato; depois reenvie.`,
      );
    }
    throw new Error(`Produto "${nome}" não existe no Bling e não foi possível criá-lo: ${msg}`);
  }
}

const paraISO = (ddmmaaaa: string) => {
  const [d, m, a] = ddmmaaaa.split("/");
  return `${a}-${m}-${d}`;
};
const centavos = (n: number) => Math.round(n * 100) / 100;

function formaPagamento(p: Pedido): number {
  if (p.meio_pagamento === "cartao_credito") {
    const n = p.forma_pagamento === "parcelado" ? (p.numero_parcelas ?? 1) : 1;
    const id = CARTAO_PAGARME[n];
    if (!id) throw new Error(`Cartão de crédito em ${n}x não tem forma de pagamento Pagar.me correspondente no Bling (1x a 12x).`);
    return id;
  }
  if (p.meio_pagamento === "cartao_debito") throw new Error("Cartão de débito ainda não tem forma de pagamento definida para o Bling.");
  return FORMA_PAGAMENTO[p.meio_pagamento];
}

function observacoesInternas(p: Pedido): string {
  const licencas = [
    `${p.licencas_pagas} ${p.licencas_pagas === 1 ? "paga" : "pagas"}`,
    p.licencas_gratuitas > 0 && `${p.licencas_gratuitas} ${p.licencas_gratuitas === 1 ? "gratuita" : "gratuitas"}`,
  ]
    .filter(Boolean)
    .join(" + ");
  return [
    `Obs Pagamento: ${p.condicao_especial ?? ""}`,
    `E-mail financeiro: ${p.emails_financeiro.join(", ")}`,
    `Licenças: ${licencas}${p.valor_licenca_adicional ? ` · licença adicional ${formatarMoeda(p.valor_licenca_adicional)}` : ""}`,
    (p.tipo_venda || p.origem) &&
      [p.tipo_venda && `Tipo de venda: ${ROTULO_TIPO_VENDA[p.tipo_venda]}`, p.origem && `Origem: ${ROTULO_ORIGEM_VENDA[p.origem]}`].filter(Boolean).join(" · "),
    `Criado via Footure OS em ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Monta o corpo de POST /pedidos/vendas (exportado para teste). */
export async function montarPedidoBling(token: string, p: Pedido, contatoId: number, hoje: string) {
  const cartao = p.meio_pagamento === "cartao_credito";
  const parcelado = p.forma_pagamento === "parcelado" && !cartao;
  const forma = { id: formaPagamento(p) };

  // Parcelas: as mesmas datas do contrato (1º pagamento + N meses); à vista e
  // cartão = uma parcela com o total (no cartão, o parcelamento é da operadora).
  const datas = parcelado
    ? gerarParcelas(p.primeiro_pagamento.split("-").reverse().join("/"), p.numero_parcelas ?? 12, p.convencao_parcelas).map((x) => paraISO(x.vencimento))
    : [p.primeiro_pagamento];
  const qtd = datas.length;

  const produtoPlano = await buscarProduto(token, nomeProdutoBling(p.perfil, p.plano));
  const comApi = p.produtos.includes("api");
  // API discriminada (software + API em itens separados) só no parcelado; à vista/cartão = um item com o total.
  const apiSeparada = parcelado && comApi && p.api_modelo === "distintos" && p.valor_mensal_api != null && p.valor_mensal_software != null;

  const valorParcela = parcelado ? centavos(p.valor_mensal) : centavos(p.valor_total);
  const itens = apiSeparada
    ? [
        { produto: produtoPlano, descricao: nomeProdutoBling(p.perfil, p.plano), valorUnit: p.valor_mensal_software! },
        { produto: await buscarProduto(token, NOME_PRODUTO_API), descricao: NOME_PRODUTO_API, valorUnit: p.valor_mensal_api! },
      ]
    : [{ produto: produtoPlano, descricao: `${nomeProdutoBling(p.perfil, p.plano)}${comApi ? " + API" : ""}`, valorUnit: valorParcela }];

  const totalItens = centavos(itens.reduce((s, i) => s + centavos(i.valorUnit) * qtd, 0));
  const totalParcelas = centavos(valorParcela * qtd);
  if (Math.abs(totalItens - totalParcelas) > 0.01) {
    throw new Error(`Soma dos itens (${formatarMoeda(totalItens)}) não bate com a das parcelas (${formatarMoeda(totalParcelas)}) — confira os valores de API e software.`);
  }

  return {
    data: hoje,
    dataPrevista: datas[0],
    contato: { id: contatoId },
    categoria: { id: CATEGORIA_POR_PERFIL[p.perfil] },
    observacoesInternas: observacoesInternas(p),
    itens: itens.map((i) => ({
      produto: { id: i.produto.id },
      ...(i.produto.codigo ? { codigo: i.produto.codigo } : {}),
      descricao: i.descricao,
      quantidade: qtd,
      valor: centavos(i.valorUnit),
    })),
    // Observação da parcela: o Bling a acrescenta ao histórico da conta a receber
    // ("Ref. ao pedido de venda nº N | Assinatura <produto> | Parcela 1/12").
    parcelas: datas.map((dataVencimento, i) => ({
      dataVencimento,
      valor: valorParcela,
      formaPagamento: forma,
      observacoes: `Assinatura ${itens.map((item) => item.descricao).join(" + ")} | Parcela ${i + 1}/${qtd}`,
    })),
  };
}

export type ResultadoEnvioBling = { ok: true; numero: string | null; aviso?: string } | { ok: false; erro: string };

/**
 * Envia o pedido aprovado ao Bling e grava o resultado no pedido (bling_*).
 * Nunca lança: em erro, grava pedidos.bling_erro e devolve { ok: false } —
 * a aprovação não trava; a tela oferece "Reenviar ao Bling".
 */
export async function enviarPedidoAoBling(supabase: Supa, pedidoId: string): Promise<ResultadoEnvioBling> {
  const registrarErro = async (erro: string): Promise<ResultadoEnvioBling> => {
    await supabase.from("pedidos").update({ bling_erro: erro }).eq("id", pedidoId);
    return { ok: false, erro };
  };
  try {
    const { data: pedido } = await supabase.from("pedidos").select("*, clientes(bling_contato_id)").eq("id", pedidoId).single();
    if (!pedido) return registrarErro("Pedido não encontrado.");
    const contatoId = (pedido.clientes as unknown as { bling_contato_id: number | null } | null)?.bling_contato_id;
    if (!contatoId) return registrarErro("Cliente sem vínculo com um contato do Bling — ajuste o cadastro do cliente e reenvie.");

    const token = await obterAccessTokenValido(supabase);
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    let blingId = pedido.bling_pedido_id ? Number(pedido.bling_pedido_id) : null;
    if (!blingId) {
      const corpo = await montarPedidoBling(token, pedido, contatoId, hoje);
      const criado = await requisicaoBling<{ data: { id: number } }>(token, "POST", "/pedidos/vendas", corpo);
      blingId = criado?.data?.id ?? null;
      if (!blingId) return registrarErro("O Bling não devolveu o id do pedido criado.");
      // Grava o vínculo logo — se uma etapa seguinte falhar, o reenvio não duplica o pedido.
      await supabase.from("pedidos").update({ bling_pedido_id: String(blingId), bling_enviado_em: new Date().toISOString() }).eq("id", pedidoId);
    }

    const avisos: string[] = [];
    try {
      await requisicaoBling(token, "POST", `/pedidos/vendas/${blingId}/lancar-contas`);
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      // Reenvio: contas já lançadas não é erro.
      if (!/lan[cç]ad/i.test(msg)) throw erro;
    }
    try {
      await requisicaoBling(token, "PATCH", `/pedidos/vendas/${blingId}/situacoes/${SITUACAO_ATENDIDO}`);
    } catch (erro) {
      avisos.push(`Pedido criado e contas lançadas, mas não foi possível marcar como "Atendido": ${erro instanceof Error ? erro.message : erro}`);
    }

    const { data: criado } = await consultarBling<{ data: { numero: number | string } }>(token, `/pedidos/vendas/${blingId}`);
    const numero = criado?.numero != null ? String(criado.numero) : null;
    await supabase.from("pedidos").update({ bling_pedido_numero: numero, bling_erro: avisos[0] ?? null }).eq("id", pedidoId);
    return { ok: true, numero, aviso: avisos[0] };
  } catch (erro) {
    return registrarErro(erro instanceof Error ? erro.message : String(erro));
  }
}

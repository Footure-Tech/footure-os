"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";

// Contrato de pedido de venda que só existe no Bling (0033): o arquivo vai do
// navegador direto para o Storage por URL assinada — Server Actions e funções
// da Vercel limitam o corpo da requisição (1 MB / 4,5 MB), e um PDF assinado
// passa disso fácil. O servidor só autoriza (gera a URL) e registra.

const EXTENSOES = ["pdf", "docx"] as const;
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

function nomeSeguro(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "contrato"
  );
}

export async function prepararUploadContratoBlingAction(
  blingPedidoId: number,
  nomeArquivo: string,
  tamanho: number,
): Promise<{ erro: string } | { path: string; token: string }> {
  await exigirPapel("admin");
  const extensao = nomeArquivo.split(".").pop()?.toLowerCase();
  if (!extensao || !(EXTENSOES as readonly string[]).includes(extensao)) return { erro: "Envie o contrato em PDF ou .docx." };
  if (tamanho <= 0) return { erro: "O arquivo está vazio." };
  if (tamanho > TAMANHO_MAXIMO) return { erro: "O arquivo passa de 20 MB." };

  const supabase = await createClient();
  const { data: pedido } = await supabase.from("bling_pedidos").select("id").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return { erro: "Pedido de venda não encontrado no cache do Bling." };

  const path = `bling/${blingPedidoId}/${Date.now()}-${nomeSeguro(nomeArquivo)}`;
  const { data, error } = await supabase.storage.from("contratos").createSignedUploadUrl(path);
  if (error || !data) return { erro: `Não foi possível preparar o envio: ${error?.message ?? "erro desconhecido"}` };
  return { path: data.path, token: data.token };
}

export async function registrarArquivoContratoBlingAction(
  blingPedidoId: number,
  path: string,
  nomeArquivo: string,
  tamanho: number,
): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("admin");
  if (!path.startsWith(`bling/${blingPedidoId}/`)) return { erro: "Caminho de arquivo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("contrato_arquivos_bling").insert({
    bling_pedido_id: blingPedidoId,
    arquivo_path: path,
    nome_arquivo: nomeArquivo.slice(0, 200),
    tamanho_bytes: tamanho,
    enviado_por: sessao.id,
  });
  if (error) return { erro: `O arquivo subiu, mas não foi possível registrá-lo: ${error.message}` };

  revalidatePath(`/financeiro/contratos/${blingPedidoId}`);
  return {};
}

export interface EstadoDadosContrato {
  erro?: string;
}

/** "1.234,56" / "1234.56" / "150" → número; vazio → null; inválido → NaN. */
function paraValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return null;
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Tela "Editar dados do contrato" (venda que veio do Bling): vigência (0034),
 * SDR/Closer (0035) e licenças (0036) — dados que o Bling não tem — salvos
 * juntos. Vigência e licenças são opcionais (em branco = não mexe); SDR e
 * Closer aceitam "não informado".
 */
export async function salvarDadosContratoBlingAction(_prev: EstadoDadosContrato, formData: FormData): Promise<EstadoDadosContrato> {
  const sessao = await exigirPapel("admin");
  const blingPedidoId = Number(formData.get("blingPedidoId"));
  const campo = (nome: string) => String(formData.get(nome) ?? "").trim();
  const inicio = campo("inicio");
  const fim = campo("fim");
  const sdrId = campo("sdr") || null;
  const closerId = campo("closer") || null;
  const textoPagas = campo("licencasPagas");
  const textoGratuitas = campo("licencasGratuitas");
  const valorAdicional = paraValor(campo("valorLicencaAdicional"));

  // Vigência
  if (!!inicio !== !!fim) return { erro: "Informe o início e o fim da vigência (ou deixe os dois em branco)." };
  if (inicio && fim < inicio) return { erro: "O fim da vigência precisa ser depois do início." };
  // Licenças
  const temLicencas = !!textoPagas || !!textoGratuitas || valorAdicional !== null;
  const pagas = Number(textoPagas || "0");
  const gratuitas = Number(textoGratuitas || "0");
  if (temLicencas && !textoPagas) return { erro: "Informe o número de licenças pagas." };
  if (temLicencas && (!Number.isInteger(pagas) || !Number.isInteger(gratuitas) || pagas < 0 || gratuitas < 0)) {
    return { erro: "Informe as licenças como números inteiros." };
  }
  if (valorAdicional !== null && (Number.isNaN(valorAdicional) || valorAdicional < 0)) return { erro: "Valor da licença adicional inválido — use o formato 1.234,56." };

  const supabase = await createClient();
  const { data: pedido } = await supabase.from("bling_pedidos").select("id").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return { erro: "Pedido de venda não encontrado no cache do Bling." };
  const ids = [sdrId, closerId].filter((id): id is string => !!id);
  if (ids.length) {
    const { data: validos } = await supabase.from("profiles").select("user_id").in("user_id", ids).in("papel", ["vendedor", "admin"]);
    if ((validos ?? []).length !== new Set(ids).size) return { erro: "Escolha SDR e Closer entre os usuários do comercial." };
  }

  const auditoria = { atualizado_por: sessao.id, atualizado_em: new Date().toISOString() };
  const [rVigencia, rEquipe, rLicencas] = await Promise.all([
    inicio ? supabase.from("contrato_vigencia_bling").upsert({ bling_pedido_id: blingPedidoId, vigencia_inicio: inicio, vigencia_fim: fim, ...auditoria }) : null,
    supabase.from("contrato_equipe_bling").upsert({ bling_pedido_id: blingPedidoId, sdr_id: sdrId, closer_id: closerId, ...auditoria }),
    temLicencas
      ? supabase.from("contrato_licencas_bling").upsert({
          bling_pedido_id: blingPedidoId,
          licencas_pagas: pagas,
          licencas_gratuitas: gratuitas,
          valor_licenca_adicional: valorAdicional === null ? null : Math.round(valorAdicional * 100) / 100,
          ...auditoria,
        })
      : null,
  ]);
  const erro = rVigencia?.error ?? rEquipe.error ?? rLicencas?.error;
  if (erro) return { erro: `Não foi possível salvar os dados do contrato: ${erro.message}` };

  revalidatePath(`/financeiro/contratos/${blingPedidoId}`);
  revalidatePath("/financeiro");
  revalidatePath("/vendas");
  revalidatePath("/clientes", "layout");
  redirect(`/financeiro/contratos/${blingPedidoId}`);
}

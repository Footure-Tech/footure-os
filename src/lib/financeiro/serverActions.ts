"use server";

import { revalidatePath } from "next/cache";
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

/** Vigência do contrato (pedido de venda do Bling) — controlada na plataforma (0034). */
export async function salvarVigenciaContratoBlingAction(blingPedidoId: number, inicio: string, fim: string): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("admin");
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.test(inicio) || !data.test(fim)) return { erro: "Informe as duas datas." };
  if (fim < inicio) return { erro: "O fim da vigência precisa ser depois do início." };

  const supabase = await createClient();
  const { data: pedido } = await supabase.from("bling_pedidos").select("id").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return { erro: "Pedido de venda não encontrado no cache do Bling." };

  const { error } = await supabase.from("contrato_vigencia_bling").upsert({
    bling_pedido_id: blingPedidoId,
    vigencia_inicio: inicio,
    vigencia_fim: fim,
    atualizado_por: sessao.id,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return { erro: `Não foi possível salvar a vigência: ${error.message}` };

  revalidatePath(`/financeiro/contratos/${blingPedidoId}`);
  revalidatePath("/financeiro");
  revalidatePath("/clientes", "layout");
  return {};
}

/** SDR e Closer de uma venda do Bling — controlados na plataforma (0035). Null = não informado. */
export async function salvarEquipeContratoBlingAction(blingPedidoId: number, sdrId: string | null, closerId: string | null): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("admin");
  const supabase = await createClient();
  const { data: pedido } = await supabase.from("bling_pedidos").select("id").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return { erro: "Pedido de venda não encontrado no cache do Bling." };

  const ids = [sdrId, closerId].filter((id): id is string => !!id);
  if (ids.length) {
    const { data: validos } = await supabase.from("profiles").select("user_id").in("user_id", ids).in("papel", ["vendedor", "admin"]);
    if ((validos ?? []).length !== new Set(ids).size) return { erro: "Escolha SDR e Closer entre os usuários do comercial." };
  }

  const { error } = await supabase.from("contrato_equipe_bling").upsert({
    bling_pedido_id: blingPedidoId,
    sdr_id: sdrId,
    closer_id: closerId,
    atualizado_por: sessao.id,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return { erro: `Não foi possível salvar SDR e Closer: ${error.message}` };

  revalidatePath(`/financeiro/contratos/${blingPedidoId}`);
  revalidatePath("/vendas");
  return {};
}

/** Licenças de uma venda do Bling — controladas na plataforma (0036). Valor adicional null = não informado. */
export async function salvarLicencasContratoBlingAction(
  blingPedidoId: number,
  licencasPagas: number,
  licencasGratuitas: number,
  valorLicencaAdicional: number | null,
): Promise<{ erro?: string }> {
  const sessao = await exigirPapel("admin");
  const inteiro = (n: number) => Number.isInteger(n) && n >= 0;
  if (!inteiro(licencasPagas) || !inteiro(licencasGratuitas)) return { erro: "Informe o número de licenças como um número inteiro." };
  if (valorLicencaAdicional !== null && (!Number.isFinite(valorLicencaAdicional) || valorLicencaAdicional < 0)) {
    return { erro: "Valor da licença adicional inválido." };
  }

  const supabase = await createClient();
  const { data: pedido } = await supabase.from("bling_pedidos").select("id").eq("id", blingPedidoId).maybeSingle();
  if (!pedido) return { erro: "Pedido de venda não encontrado no cache do Bling." };

  const { error } = await supabase.from("contrato_licencas_bling").upsert({
    bling_pedido_id: blingPedidoId,
    licencas_pagas: licencasPagas,
    licencas_gratuitas: licencasGratuitas,
    valor_licenca_adicional: valorLicencaAdicional === null ? null : Math.round(valorLicencaAdicional * 100) / 100,
    atualizado_por: sessao.id,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return { erro: `Não foi possível salvar as licenças: ${error.message}` };

  revalidatePath(`/financeiro/contratos/${blingPedidoId}`);
  return {};
}

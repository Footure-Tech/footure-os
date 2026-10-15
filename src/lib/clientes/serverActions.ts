"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { sincronizarContatosBling } from "@/lib/integracoes/bling";

const ClientePayloadSchema = z.object({
  clienteId: z.string().uuid().optional(), // presente = edição
  blingContatoId: z.number(), // razão social/CNPJ vêm do Bling, nunca digitados aqui
  tipo: z.enum(["clube", "agente"]),
  nomeFantasia: z.string().optional(),
  apelido: z.string().optional(), // só faz sentido pra clube — validado na UI, não aqui
  endereco: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cep: z.string().min(1),
  municipio: z.string().min(1),
  uf: z.string().length(2),
  foroPreferencial: z.string().min(1),
});

export interface SalvarClienteState {
  erro?: string;
}

/** Cria (ou atualiza, se clienteId vier no payload) um cliente, com upload opcional de logo. */
export async function salvarClienteAction(_prev: SalvarClienteState, formData: FormData): Promise<SalvarClienteState> {
  await exigirPapel("vendedor", "admin");
  const bruto = JSON.parse(String(formData.get("payload") ?? "{}"));
  const parsed = ClientePayloadSchema.safeParse(bruto);
  if (!parsed.success) {
    return { erro: `Dados inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  const payload = parsed.data;
  const supabase = await createClient();

  // Razão social/CNPJ sempre vêm do contato do Bling (fonte única de
  // identidade) — nunca do que o formulário mandou, pra não confiar em texto
  // que o cliente do navegador poderia ter alterado e pra sempre gravar a
  // versão mais atual já que estamos buscando de qualquer forma.
  const { data: contatoBling, error: erroContato } = await supabase
    .from("bling_contatos")
    .select("nome, cnpj")
    .eq("id", payload.blingContatoId)
    .single();
  if (erroContato || !contatoBling) return { erro: "Contato do Bling não encontrado — sincronize novamente e tente de novo." };

  const linha = {
    tipo: payload.tipo,
    razao_social: contatoBling.nome,
    cnpj: contatoBling.cnpj,
    bling_contato_id: payload.blingContatoId,
    nome_fantasia: payload.nomeFantasia || null,
    apelido: payload.tipo === "clube" ? payload.apelido || null : null,
    endereco: payload.endereco,
    numero: payload.numero,
    complemento: payload.complemento || null,
    bairro: payload.bairro,
    cep: payload.cep,
    municipio: payload.municipio,
    uf: payload.uf,
    foro_preferencial: payload.foroPreferencial,
  };

  let clienteId = payload.clienteId;
  if (clienteId) {
    const { error } = await supabase.from("clientes").update(linha).eq("id", clienteId);
    if (error) return { erro: `Falha ao salvar cliente: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("clientes").insert(linha).select("id").single();
    if (error || !data) return { erro: `Falha ao criar cliente: ${error?.message}` };
    clienteId = data.id;
  }

  const imagem = formData.get("imagem") as File | null;
  if (imagem && imagem.size > 0) {
    const path = `${clienteId}/logo`;
    const buffer = Buffer.from(await imagem.arrayBuffer());
    const { error: erroUpload } = await supabase.storage
      .from("logos-clientes")
      .upload(path, buffer, { contentType: imagem.type, upsert: true });
    if (erroUpload) return { erro: `Cliente salvo, mas falhou ao enviar a imagem: ${erroUpload.message}` };

    const { error: erroUpdate } = await supabase.from("clientes").update({ logo_path: path }).eq("id", clienteId);
    if (erroUpdate) return { erro: `Cliente salvo, mas falhou ao registrar a imagem: ${erroUpdate.message}` };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function sincronizarContatosBlingAction(): Promise<{ totalContatos: number; novosClientesRegistrados: number; baixasImportadas: number }> {
  await exigirPapel("vendedor", "admin");
  const supabase = await createClient();
  const resultado = await sincronizarContatosBling(supabase);
  revalidatePath("/clientes");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/pagamentos");
  revalidatePath("/inadimplencia");
  return resultado;
}

/** Só remove clientes sem pedido vinculado — a FK (sem cascade) é o backstop caso essa checagem seja pulada. */
export async function excluirClienteAction(clienteId: string) {
  await exigirPapel("vendedor", "admin");
  const supabase = await createClient();

  const { count, error: erroContagem } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);
  if (erroContagem) throw new Error(erroContagem.message);
  if ((count ?? 0) > 0) {
    throw new Error("Este cliente possui pedidos vinculados e não pode ser excluído.");
  }

  const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
}

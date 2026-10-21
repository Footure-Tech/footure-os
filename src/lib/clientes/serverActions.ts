"use server";

import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "@/lib/auth/session";
import { executarSincronizacaoBling, type ResultadoSincronizacaoBling } from "@/lib/integracoes/blingSincronizacao";
import {
  garantirContatoBling,
  verificarCnpj,
  dadosEmpresaDoPayload,
  linhaIdentidadeCliente,
  type ContatoBlingEncontrado,
  type DadosEmpresa,
  type VerificacaoCnpj,
} from "@/lib/clientes/vinculoBling";

const ClientePayloadSchema = z.object({
  clienteId: z.string().uuid().optional(), // presente = edição
  // Só para cliente sem vínculo com o Bling (novo ou legado): a identidade
  // digitada é conferida/cadastrada no Bling (vinculoBling.ts). Cliente já
  // vinculado ignora esses dois — razão social/CNPJ seguem o Bling.
  razaoSocial: z.string().optional(),
  cnpj: z.string().optional(),
  decisaoBling: z.enum(["atualizar_bling", "usar_bling"]).optional(),
  tipo: z.enum(["clube", "agente"]),
  nomeFantasia: z.string().optional(),
  apelido: z.string().optional(), // só faz sentido pra clube — validado na UI, não aqui
  footlinkOrgId: z.string().max(100).optional(), // conta do cliente no Footlink (0037) — opcional, só existe aqui
  endereco: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cep: z.string().min(1),
  municipio: z.string().min(1),
  uf: z.string().length(2),
  foroPreferencial: z.string().min(1),
});

/** Índice único de 0037: a mesma organização do Footlink não pode ficar em dois clientes. */
function erroFootlinkDuplicado(error: { code?: string; message: string }) {
  return error.code === "23505" && error.message.includes("footlink_org_id")
    ? "Esse ID de organização do Footlink já está vinculado a outro cliente."
    : null;
}

export interface SalvarClienteState {
  erro?: string;
  /** CNPJ já existe no Bling com dados diferentes — a tela pergunta o que fazer e reenvia com decisaoBling. */
  divergenciaBling?: ContatoBlingEncontrado;
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

  const complemento = {
    tipo: payload.tipo,
    apelido: payload.tipo === "clube" ? payload.apelido || null : null,
    footlink_org_id: payload.footlinkOrgId?.trim() || null,
    foro_preferencial: payload.foroPreferencial,
  };

  const { data: atual } = payload.clienteId
    ? await supabase.from("clientes").select("bling_contato_id").eq("id", payload.clienteId).single()
    : { data: null };

  let linha;
  if (atual?.bling_contato_id != null) {
    // Já vinculado: razão social/CNPJ sempre do contato do Bling (fonte única
    // de identidade) — nunca do formulário.
    const { data: contatoBling, error: erroContato } = await supabase
      .from("bling_contatos")
      .select("nome, cnpj")
      .eq("id", atual.bling_contato_id)
      .single();
    if (erroContato || !contatoBling) return { erro: "Contato do Bling não encontrado — sincronize novamente e tente de novo." };
    linha = {
      ...complemento,
      razao_social: contatoBling.nome,
      cnpj: contatoBling.cnpj,
      nome_fantasia: payload.nomeFantasia || null,
      endereco: payload.endereco,
      numero: payload.numero,
      complemento: payload.complemento || null,
      bairro: payload.bairro,
      cep: payload.cep,
      municipio: payload.municipio,
      uf: payload.uf,
    };
  } else {
    // Novo (ou legado sem vínculo): confere o CNPJ no Bling, cadastrando lá se não existir.
    if (!payload.razaoSocial?.trim() || !payload.cnpj?.trim()) return { erro: "Informe a razão social e o CNPJ." };
    let resultado;
    try {
      resultado = await garantirContatoBling(
        supabase,
        dadosEmpresaDoPayload({ ...payload, razaoSocial: payload.razaoSocial, cnpj: payload.cnpj }),
        payload.decisaoBling,
        payload.clienteId,
      );
    } catch (erro) {
      return { erro: erro instanceof Error ? erro.message : String(erro) };
    }
    if (resultado.status === "divergente") return { divergenciaBling: resultado.contato };
    linha = { ...complemento, ...linhaIdentidadeCliente(resultado.dados), bling_contato_id: resultado.contatoId };
  }

  let clienteId = payload.clienteId;
  if (clienteId) {
    const { error } = await supabase.from("clientes").update(linha).eq("id", clienteId);
    if (error) return { erro: erroFootlinkDuplicado(error) ?? `Falha ao salvar cliente: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("clientes").insert(linha).select("id").single();
    if (error || !data) return { erro: (error && erroFootlinkDuplicado(error)) ?? `Falha ao criar cliente: ${error?.message}` };
    clienteId = data.id;
  }

  const imagem = formData.get("imagem") as File | null;
  if (imagem && imagem.size > 0) {
    const { data: anterior } = await supabase.from("clientes").select("logo_path").eq("id", clienteId).single();
    // Caminho novo a cada troca: a URL pública fica 1 h em cache (max-age=3600) —
    // regravar o mesmo caminho fazia o navegador seguir mostrando o logo antigo.
    const path = `${clienteId}/logo-${Date.now()}`;
    const buffer = Buffer.from(await imagem.arrayBuffer());
    const { error: erroUpload } = await supabase.storage.from("logos-clientes").upload(path, buffer, { contentType: imagem.type });
    if (erroUpload) return { erro: `Cliente salvo, mas falhou ao enviar a imagem: ${erroUpload.message}` };

    const { error: erroUpdate } = await supabase.from("clientes").update({ logo_path: path }).eq("id", clienteId);
    if (erroUpdate) return { erro: `Cliente salvo, mas falhou ao registrar a imagem: ${erroUpdate.message}` };
    if (anterior?.logo_path && anterior.logo_path !== path) await supabase.storage.from("logos-clientes").remove([anterior.logo_path]);
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export type ResultadoVerificacaoCnpj = Partial<VerificacaoCnpj> & ResultadoAcao;

/** Ao sair do campo CNPJ (tela de Clientes e cadastro rápido no pedido): já é cliente aqui? já existe no Bling? */
export async function verificarCnpjAction(dados: DadosEmpresa, ignorarClienteId?: string): Promise<ResultadoVerificacaoCnpj> {
  let resultado: VerificacaoCnpj | null = null;
  const r = await executar(async () => {
    await exigirPapel("vendedor", "admin");
    resultado = await verificarCnpj(await createClient(), dados.cnpj, dados, ignorarClienteId);
  });
  return r.erro || !resultado ? r : resultado;
}

export async function sincronizarContatosBlingAction(): Promise<Partial<ResultadoSincronizacaoBling> & ResultadoAcao> {
  let resultado: ResultadoSincronizacaoBling | null = null;
  const r = await executar(async () => {
    const sessao = await exigirPapel("vendedor", "admin");
    resultado = await executarSincronizacaoBling(await createClient(), { origem: "manual", disparadoPor: sessao.id });
  });
  return r.erro || !resultado ? r : resultado;
}

/** Só remove clientes sem pedido vinculado — a FK (sem cascade) é o backstop caso essa checagem seja pulada. */
export async function excluirClienteAction(clienteId: string): Promise<ResultadoAcao> {
  return executar(async () => {
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
  });
}

"use server";

import { executar, type ResultadoAcao } from "@/lib/acaoServidor";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exigirPapel } from "@/lib/auth/session";
import { enviarEmailSenhaTemporaria } from "@/lib/integracoes/resend";
import type { PapelUsuario } from "@/lib/supabase/database.types";

// Sem caracteres ambíguos (0/O, 1/l/I) — mais fácil de digitar quando alguém
// precisa ler a senha temporária em voz alta ou copiar de um e-mail.
const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function gerarSenhaTemporaria(tamanho = 12): string {
  let senha = "";
  for (let i = 0; i < tamanho; i++) senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  return senha;
}

export interface CriarUsuarioInput {
  nome: string;
  email: string;
  papel: PapelUsuario;
}

/** Cria o usuário no Supabase Auth (com senha temporária), ajusta o papel no
 * profile (o trigger de criação já roda com papel default 'vendedor') e
 * dispara o e-mail com a senha. Se o e-mail falhar, a conta já existe — o
 * erro deixa isso explícito pro admin decidir o que fazer. */
export async function criarUsuario(dados: CriarUsuarioInput): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel("admin");
    const nome = dados.nome.trim();
    const email = dados.email.trim();
    if (!nome || !email) throw new Error("Nome e e-mail são obrigatórios.");

    const senhaTemporaria = gerarSenhaTemporaria();
    const service = createServiceClient();

    const { data: criado, error: erroCriacao } = await service.auth.admin.createUser({
      email,
      password: senhaTemporaria,
      email_confirm: true,
      // Marca a senha como temporária: o sistema avisa até o usuário definir uma pessoal.
      user_metadata: { nome, senha_temporaria: true },
    });
    if (erroCriacao || !criado.user) {
      throw new Error(erroCriacao?.message ?? "Falha ao criar usuário.");
    }

    if (dados.papel !== "vendedor") {
      const { error: erroPapel } = await service.from("profiles").update({ papel: dados.papel }).eq("user_id", criado.user.id);
      if (erroPapel) throw new Error(`Usuário criado, mas falha ao definir o papel: ${erroPapel.message}`);
    }

    try {
      await enviarEmailSenhaTemporaria(email, nome, senhaTemporaria);
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      throw new Error(`Usuário criado, mas o e-mail com a senha não foi enviado: ${msg}`);
    }

    revalidatePath("/admin/usuarios");
  });
}

/** Gera uma nova senha temporária e reenvia o e-mail de acesso (senha
 * anterior deixa de valer). Para quem perdeu o e-mail do cadastro ou nunca
 * conseguiu entrar. */
export async function reenviarAcessoAction(userId: string): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel("admin");
    const service = createServiceClient();

    const { data: encontrado, error: erroBusca } = await service.auth.admin.getUserById(userId);
    if (erroBusca || !encontrado.user?.email) throw new Error(erroBusca?.message ?? "Usuário sem e-mail cadastrado.");
    const { data: profile } = await service.from("profiles").select("nome, ativo").eq("user_id", userId).single();
    if (!profile?.ativo) throw new Error("Usuário inativo — ative a conta antes de reenviar o acesso.");

    const senhaTemporaria = gerarSenhaTemporaria();
    const { error: erroSenha } = await service.auth.admin.updateUserById(userId, {
      password: senhaTemporaria,
      user_metadata: { ...encontrado.user.user_metadata, senha_temporaria: true },
    });
    if (erroSenha) throw new Error(`Falha ao gerar a nova senha: ${erroSenha.message}`);

    try {
      await enviarEmailSenhaTemporaria(encontrado.user.email, profile.nome, senhaTemporaria, false);
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      throw new Error(`Nova senha gerada, mas o e-mail não foi enviado: ${msg}`);
    }
  });
}

export async function editarUsuario(userId: string, dados: { nome: string; papel: PapelUsuario }): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel("admin");
    const nome = dados.nome.trim();
    if (!nome) throw new Error("Nome é obrigatório.");

    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ nome, papel: dados.papel }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/usuarios");
  });
}

export async function definirAtivoUsuario(userId: string, ativo: boolean): Promise<ResultadoAcao> {
  return executar(async () => {
    await exigirPapel("admin");
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ ativo }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/usuarios");
  });
}

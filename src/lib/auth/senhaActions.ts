"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { obterSessao } from "@/lib/auth/session";
import { enviarEmailRedefinicaoSenha } from "@/lib/integracoes/resend";
import { urlDoSistema } from "@/lib/email/layout";

export interface EstadoSenha {
  erro?: string;
  sucesso?: string;
}

const TAMANHO_MINIMO = 8;

function validarNovaSenha(nova: string, confirmacao: string): string | null {
  if (nova.length < TAMANHO_MINIMO) return `A nova senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`;
  if (nova !== confirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}

/**
 * "Esqueci minha senha". Gera o link de recuperação pela API admin do Supabase
 * (generateLink NÃO envia o e-mail padrão do Supabase) e envia pelo nosso
 * template via Resend. O link aponta para /auth/confirmar, que troca o token
 * por uma sessão (verifyOtp) e leva a /redefinir-senha. A resposta é sempre a
 * mesma — não revela se o e-mail tem conta.
 */
export async function solicitarRedefinicaoAction(_prev: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe um e-mail válido." };

  const RESPOSTA = { sucesso: "Se esse e-mail tiver uma conta ativa, enviamos um link para criar uma nova senha. Confira também a caixa de spam." };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.user || !data.properties?.hashed_token) {
    // E-mail sem conta (ou erro do Supabase): mesma resposta, só registra no servidor.
    if (error) console.error("[senha] generateLink:", error.message);
    return RESPOSTA;
  }

  const { data: profile } = await service.from("profiles").select("nome, ativo").eq("user_id", data.user.id).single();
  if (!profile?.ativo) return RESPOSTA;

  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "recovery", next: "/redefinir-senha" });
  try {
    await enviarEmailRedefinicaoSenha(email, profile.nome, `${urlDoSistema()}/auth/confirmar?${params}`);
  } catch (erro) {
    console.error("[senha] envio do e-mail de redefinição:", erro);
    return { erro: "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos." };
  }
  return RESPOSTA;
}

/** Nova senha a partir do link do e-mail (a sessão já foi criada em /auth/confirmar). */
export async function definirNovaSenhaAction(_prev: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const nova = String(formData.get("nova") ?? "");
  const invalida = validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));
  if (invalida) return { erro: invalida };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "O link expirou. Peça um novo em “Esqueci minha senha”." };

  const { error } = await supabase.auth.updateUser({ password: nova, data: { senha_temporaria: false } });
  if (error) return { erro: `Não foi possível salvar a senha: ${error.message}` };

  redirect("/");
}

/** Troca de senha no Perfil — confirma a senha atual antes. */
export async function alterarSenhaAction(_prev: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const sessao = await obterSessao();
  if (!sessao?.email) redirect("/login");

  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const invalida = validarNovaSenha(nova, String(formData.get("confirmacao") ?? ""));
  if (invalida) return { erro: invalida };
  if (nova === atual) return { erro: "A nova senha precisa ser diferente da atual." };

  const supabase = await createClient();
  const { error: erroAtual } = await supabase.auth.signInWithPassword({ email: sessao.email, password: atual });
  if (erroAtual) return { erro: "A senha atual não confere." };

  const { error } = await supabase.auth.updateUser({ password: nova, data: { senha_temporaria: false } });
  if (error) return { erro: `Não foi possível salvar a senha: ${error.message}` };

  return { sucesso: "Senha alterada. Use a nova senha no próximo acesso." };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PapelUsuario } from "@/lib/supabase/database.types";

export interface SessaoUsuario {
  id: string;
  email: string | null;
  nome: string;
  papel: PapelUsuario;
  /** Entrou com a senha temporária do cadastro/reenvio e ainda não definiu uma pessoal. */
  senhaTemporaria: boolean;
}

// Lê usuário + papel a partir da sessão atual. Retorna null se não logado —
// quem chama decide se isso é um redirect (página) ou um erro (Server Action).
export async function obterSessao(): Promise<SessaoUsuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, papel, ativo")
    .eq("user_id", user.id)
    .single();

  // Usuário inativo trata como não-logado — pega sessões que já existiam
  // antes da inativação (o login em si também barra antes de chegar aqui).
  if (!profile || !profile.ativo) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    nome: profile.nome,
    papel: profile.papel,
    senhaTemporaria: user.user_metadata?.senha_temporaria === true,
  };
}

// Uso em Server Actions/Route Handlers: garante papel autorizado ou lança.
// Proxy.ts já faz um redirect "otimista" por UX, mas cada mutação precisa
// checar de novo — Server Actions são chamáveis como POST direto, então a
// checagem de página não é suficiente (ver node_modules/next/dist/docs).
export async function exigirPapel(...papeis: PapelUsuario[]): Promise<SessaoUsuario> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (!papeis.includes(sessao.papel)) {
    throw new Error(`Ação não permitida para o papel "${sessao.papel}".`);
  }
  return sessao;
}

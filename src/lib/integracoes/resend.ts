// Envio de e-mail transacional via Resend (developers.resend.com, API HTTP
// simples — sem SDK, evita mais uma dependência). O conteúdo e a marca ficam
// em src/lib/email (template único); aqui só o transporte e as mensagens.
import { montarEmail, urlDoSistema } from "@/lib/email/layout";

async function enviarEmail(para: string, assunto: string, conteudo: Parameters<typeof montarEmail>[0]) {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !remetente) throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL não configurados.");

  const { html, texto } = montarEmail(conteudo);
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remetente, to: para, subject: assunto, html, text: texto }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar e-mail via Resend (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Cadastro de usuário novo (criado = true) ou reenvio de acesso (criado = false). */
export async function enviarEmailSenhaTemporaria(destinatario: string, nome: string, senhaTemporaria: string, criado = true) {
  const url = urlDoSistema();
  await enviarEmail(destinatario, criado ? "Seu acesso ao Footlink" : "Novo acesso ao Footlink", {
    preheader: criado ? "Sua conta foi criada — veja como entrar." : "Geramos uma nova senha temporária para você.",
    titulo: criado ? `Olá, ${nome}! Seu acesso está pronto` : `Olá, ${nome}! Aqui está seu novo acesso`,
    blocos: [
      {
        paragrafo: criado
          ? "Uma conta foi criada para você no Footlink. Use os dados abaixo para entrar:"
          : "Um administrador gerou uma nova senha temporária para você. A senha anterior deixou de valer.",
      },
      {
        dados: [
          { rotulo: "E-mail", valor: destinatario },
          { rotulo: "Senha temporária", valor: senhaTemporaria, mono: true },
        ],
      },
      { paragrafo: "No primeiro acesso, defina uma senha pessoal em Meu perfil → Alterar senha." },
    ],
    botao: { rotulo: "Acessar o Footlink", url: `${url}/login` },
    observacao: "Se você não esperava este e-mail, avise o administrador do sistema.",
  });
}

/** Link de redefinição de senha ("Esqueci minha senha"). */
export async function enviarEmailRedefinicaoSenha(destinatario: string, nome: string, link: string) {
  await enviarEmail(destinatario, "Redefinir sua senha do Footlink", {
    preheader: "Use o link para criar uma nova senha.",
    titulo: `Olá, ${nome}! Vamos redefinir sua senha`,
    blocos: [{ paragrafo: "Recebemos um pedido para redefinir a senha da sua conta no Footlink. Clique no botão para criar uma nova senha:" }],
    botao: { rotulo: "Criar nova senha", url: link },
    observacao: "O link vale por tempo limitado e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail — sua senha atual continua valendo.",
  });
}

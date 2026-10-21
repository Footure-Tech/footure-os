// Envio de e-mail transacional via Resend (developers.resend.com, API HTTP
// simples — sem SDK, evita mais uma dependência). O conteúdo e a marca ficam
// em src/lib/email (template único); aqui só o transporte e as mensagens.
import { NOME_DO_SISTEMA, montarEmail, urlDoSistema } from "@/lib/email/layout";
import { LOGO_EMAIL_BASE64, LOGO_EMAIL_CID } from "@/lib/email/logo";

/** Remetente sempre exibido como "Footure OS", mesmo que RESEND_FROM_EMAIL
 * venha só com o endereço ou com outro nome ("Fulano <x@y>"). */
function comNomeDoSistema(remetente: string) {
  const endereco = remetente.match(/<([^>]+)>/)?.[1] ?? remetente.trim();
  return `${NOME_DO_SISTEMA} <${endereco}>`;
}

async function enviarEmail(para: string | string[], assunto: string, conteudo: Parameters<typeof montarEmail>[0]) {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !remetente) throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL não configurados.");

  const { html, texto } = montarEmail(conteudo);
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: comNomeDoSistema(remetente),
      to: para,
      subject: assunto,
      html,
      text: texto,
      // Logo do cabeçalho embutido (cid:) — ver lib/email/logo.ts.
      attachments: [{ filename: "footure-logo.png", content: LOGO_EMAIL_BASE64, content_id: LOGO_EMAIL_CID }],
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar e-mail via Resend (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Cadastro de usuário novo (criado = true) ou reenvio de acesso (criado = false). */
export async function enviarEmailSenhaTemporaria(destinatario: string, nome: string, senhaTemporaria: string, criado = true) {
  const url = urlDoSistema();
  await enviarEmail(destinatario, criado ? "Seu acesso ao Footure OS" : "Novo acesso ao Footure OS", {
    preheader: criado ? "Sua conta foi criada — veja como entrar." : "Geramos uma nova senha temporária para você.",
    titulo: criado ? `Olá, ${nome}! Seu acesso está pronto` : `Olá, ${nome}! Aqui está seu novo acesso`,
    blocos: [
      {
        paragrafo: criado
          ? "Uma conta foi criada para você no Footure OS. Use os dados abaixo para entrar:"
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
    botao: { rotulo: "Acessar o Footure OS", url: `${url}/login` },
    observacao: "Se você não esperava este e-mail, avise o administrador do sistema.",
  });
}

/** Link de redefinição de senha ("Esqueci minha senha"). */
export async function enviarEmailRedefinicaoSenha(destinatario: string, nome: string, link: string) {
  await enviarEmail(destinatario, "Redefinir sua senha do Footure OS", {
    preheader: "Use o link para criar uma nova senha.",
    titulo: `Olá, ${nome}! Vamos redefinir sua senha`,
    blocos: [{ paragrafo: "Recebemos um pedido para redefinir a senha da sua conta no Footure OS. Clique no botão para criar uma nova senha:" }],
    botao: { rotulo: "Criar nova senha", url: link },
    observacao: "O link vale por tempo limitado e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail — sua senha atual continua valendo.",
  });
}

/** Aviso ao jurídico: contrato gerado e aguardando validação. */
export async function enviarEmailContratoParaValidacao(
  destinatarios: string[],
  dados: { cliente: string; plano: string; valorTotal: string; versao: number; motivo: string; link: string },
) {
  await enviarEmail(destinatarios, `Contrato para validação · ${dados.cliente}`, {
    preheader: `Contrato v${dados.versao} de ${dados.cliente} aguardando validação do jurídico.`,
    titulo: "Há um contrato aguardando sua validação",
    blocos: [
      { paragrafo: `${dados.motivo} Revise o contrato e libere para assinatura quando estiver pronto.` },
      {
        dados: [
          { rotulo: "Cliente", valor: dados.cliente },
          { rotulo: "Plano", valor: dados.plano },
          { rotulo: "Valor total", valor: dados.valorTotal },
          { rotulo: "Versão", valor: `v${dados.versao}` },
        ],
      },
    ],
    botao: { rotulo: "Validar contrato", url: dados.link },
    observacao: "Você recebe este aviso como responsável pela validação jurídica dos contratos da Footure.",
  });
}

/** Aviso à diretoria: pedido de venda enviado para aprovação. */
export async function enviarEmailPedidoParaAprovacao(
  destinatarios: string[],
  dados: { cliente: string; plano: string; valorTotal: string; pagamento: string; criadoPor: string; sdr: string; closer: string; link: string },
) {
  await enviarEmail(destinatarios, `Pedido para aprovação · ${dados.cliente}`, {
    preheader: `${dados.criadoPor} enviou o pedido de ${dados.cliente} para aprovação.`,
    titulo: "Há um pedido de venda aguardando sua aprovação",
    blocos: [
      { paragrafo: `${dados.criadoPor} enviou um pedido de venda para aprovação. Revise as condições e aprove ou devolva ao vendedor.` },
      {
        dados: [
          { rotulo: "Cliente", valor: dados.cliente },
          { rotulo: "Plano", valor: dados.plano },
          { rotulo: "Valor total", valor: dados.valorTotal },
          { rotulo: "Pagamento", valor: dados.pagamento },
          { rotulo: "SDR", valor: dados.sdr },
          { rotulo: "Closer", valor: dados.closer },
        ],
      },
    ],
    botao: { rotulo: "Revisar pedido", url: dados.link },
    observacao: "Você recebe este aviso por ter o perfil Diretoria no Footure OS.",
  });
}

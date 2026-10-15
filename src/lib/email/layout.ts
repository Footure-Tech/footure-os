// Template de e-mail transacional com a marca Footlink (por enquanto — trocar
// logo/nome aqui quando a marca da plataforma mudar). HTML de e-mail: tabelas
// e estilos inline (Gmail/Outlook ignoram <style> e flexbox), largura máx.
// 560px, logo em PNG (SVG não é exibido no Gmail/Outlook), sempre com versão
// em texto puro.

const ROXO = "#5a00ff";
const TEXTO = "#09001a";
const CINZA = "#62747c";
const BORDA = "#e0e0e0";
const FUNDO = "#f5f5f5";
const FONTE = "Barlow, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** URL pública do sistema, usada nos links e na imagem do logo. APP_URL tem
 * prioridade; na Vercel, cai no domínio de produção do projeto. */
export function urlDoSistema(): string {
  const configurada = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configurada) return configurada;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface BlocoEmail {
  /** Parágrafo de texto (escapado). */
  paragrafo?: string;
  /** Caixa destacada com pares rótulo → valor (ex.: e-mail e senha temporária). */
  dados?: { rotulo: string; valor: string; mono?: boolean }[];
}

export interface ConteudoEmail {
  /** Texto curto que aparece na prévia da caixa de entrada. */
  preheader: string;
  titulo: string;
  blocos: BlocoEmail[];
  botao?: { rotulo: string; url: string };
  /** Linha pequena abaixo do botão (ex.: validade do link). */
  observacao?: string;
}

function blocoHtml(b: BlocoEmail): string {
  if (b.paragrafo) {
    return `<p style="margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:1.6;color:${TEXTO};">${escaparHtml(b.paragrafo)}</p>`;
  }
  if (b.dados) {
    const linhas = b.dados
      .map(
        (d) => `<tr>
          <td style="padding:6px 0;font-family:${FONTE};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${CINZA};white-space:nowrap;vertical-align:top;">${escaparHtml(d.rotulo)}</td>
          <td style="padding:6px 0 6px 16px;font-family:${d.mono ? "'SFMono-Regular', Menlo, Consolas, monospace" : FONTE};font-size:15px;font-weight:700;color:${TEXTO};word-break:break-all;">${escaparHtml(d.valor)}</td>
        </tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${FUNDO};border:1px solid ${BORDA};border-radius:10px;">
      <tr><td style="padding:12px 18px;"><table role="presentation" cellpadding="0" cellspacing="0">${linhas}</table></td></tr>
    </table>`;
  }
  return "";
}

export function montarEmail(conteudo: ConteudoEmail): { html: string; texto: string } {
  const url = urlDoSistema();
  const botao = conteudo.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
        <tr><td style="border-radius:8px;background:${ROXO};">
          <a href="${escaparHtml(conteudo.botao.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONTE};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escaparHtml(conteudo.botao.rotulo)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-family:${FONTE};font-size:12px;line-height:1.5;color:${CINZA};">Se o botão não funcionar, copie e cole no navegador:<br><a href="${escaparHtml(conteudo.botao.url)}" style="color:${ROXO};word-break:break-all;">${escaparHtml(conteudo.botao.url)}</a></p>`
    : "";
  const observacao = conteudo.observacao
    ? `<p style="margin:0;font-family:${FONTE};font-size:13px;line-height:1.5;color:${CINZA};">${escaparHtml(conteudo.observacao)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escaparHtml(conteudo.titulo)}</title></head>
<body style="margin:0;padding:0;background:${FUNDO};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escaparHtml(conteudo.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:${ROXO};border-radius:12px 12px 0 0;padding:22px 32px;">
          <img src="${url}/email/footlink-logo.png" width="133" height="32" alt="Footlink" style="display:block;border:0;outline:none;width:133px;height:32px;">
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${BORDA};border-top:0;border-radius:0 0 12px 12px;padding:32px;">
          <h1 style="margin:0 0 20px;font-family:${FONTE};font-size:22px;line-height:1.3;font-weight:700;color:${TEXTO};">${escaparHtml(conteudo.titulo)}</h1>
          ${conteudo.blocos.map(blocoHtml).join("\n")}
          ${botao}
          ${observacao}
        </td></tr>
        <tr><td style="padding:20px 32px 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${CINZA};text-align:center;">
          Footlink · Footure — e-mail automático, não responda.<br>
          <a href="${url}" style="color:${CINZA};">${escaparHtml(url.replace(/^https?:\/\//, ""))}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const texto = [
    conteudo.titulo,
    "",
    ...conteudo.blocos.flatMap((b) => (b.paragrafo ? [b.paragrafo, ""] : b.dados ? [...b.dados.map((d) => `${d.rotulo}: ${d.valor}`), ""] : [])),
    ...(conteudo.botao ? [`${conteudo.botao.rotulo}: ${conteudo.botao.url}`, ""] : []),
    ...(conteudo.observacao ? [conteudo.observacao, ""] : []),
    "—",
    `Footlink · Footure · ${url}`,
  ].join("\n");

  return { html, texto };
}

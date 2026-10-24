// Textos dos e-mails da régua de cobrança (aprovados pela Diretoria e pelo
// financeiro antes de ligar). Cliente: marca Footlink, responder fala com o
// financeiro. Escalonamento: e-mail interno, marca Footure OS.
import { montarEmail, urlDoSistema, type MarcaEmail } from "@/lib/email/layout";
import { LOGO_FOOTLINK_BASE64, LOGO_FOOTLINK_CID } from "@/lib/email/logoFootlink";
import { LOGO_EMAIL_BASE64, LOGO_EMAIL_CID } from "@/lib/email/logo";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import type { TipoEnvioCobranca } from "@/lib/supabase/database.types";

export interface ItemEmailCobranca {
  rotulo: string;
  vencimento: string;
  valor: number;
  /** Dias desde o vencimento na data do envio (negativo = a vencer). */
  dias: number;
  /** Boleto do Inter da parcela (F2). "previa" = será emitido no envio (prévia e modo de teste mostram o lugar). */
  pagamento?: { linhaDigitavel: string | null; pixCopiaECola: string | null } | "previa" | null;
}

export interface EmailCobrancaMontado {
  assunto: string;
  html: string;
  texto: string;
  anexos: { nome: string; base64: string; contentId: string }[];
}

const MARCA_FOOTLINK: MarcaEmail = {
  logoCid: LOGO_FOOTLINK_CID,
  logoLargura: 125,
  logoAltura: 30,
  logoAlt: "Footlink",
  rodape: ["Footlink · Footure Football Company — Financeiro", "Dúvidas sobre esta cobrança? É só responder este e-mail."],
  linkDoSistema: false,
};

/** Até quantos dias de atraso o e-mail usa o tom leve (o primeiro aviso, em D+3, considerando
 * que o boleto leva até 2 dias úteis para compensar); daí em diante, o tom firme. */
const ATRASO_TOM_LEVE_DIAS = 4;

const data = (iso: string) => formatarDataCurta(iso).replace(/\/(\d{2})$/, "/20$1");

function situacao(item: ItemEmailCobranca) {
  if (item.dias < 0) return `vence em ${data(item.vencimento)}`;
  if (item.dias === 0) return "vence hoje";
  return item.dias === 1 ? "1 dia em atraso" : `${item.dias} dias em atraso`;
}

/** Com mais de uma parcela, a tabela fecha com o total em negrito. */
function tabelaParcelas(itens: ItemEmailCobranca[], comSituacao: boolean, rotuloTotal = "Total") {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return {
    total: itens.length > 1 ? { rotulo: rotuloTotal, valor: formatarMoeda(total) } : undefined,
    colunas: comSituacao ? ["Parcela", "Vencimento", "Situação", "Valor"] : ["Parcela", "Vencimento", "Valor"],
    linhas: itens.map((i) =>
      comSituacao ? [i.rotulo, data(i.vencimento), i.dias > 0 ? `${i.dias} ${i.dias === 1 ? "dia" : "dias"} em atraso` : i.dias === 0 ? "vence hoje" : "a vencer", formatarMoeda(i.valor)] : [i.rotulo, data(i.vencimento), formatarMoeda(i.valor)],
    ),
  };
}

/** "Como pagar": linha digitável e Pix copia e cola de cada parcela com boleto (F2). */
function blocosComoPagar(itens: ItemEmailCobranca[]) {
  const comBoleto = itens.filter((i) => i.pagamento);
  if (!comBoleto.length) return [];
  const varias = comBoleto.length > 1;
  return [
    {
      paragrafo: `Para pagar${varias ? " cada parcela" : ""}, use a linha digitável do boleto ou copie o código Pix e cole no app do seu banco, na opção Pix copia e cola:`,
    },
    ...comBoleto.map((i) =>
      i.pagamento === "previa"
        ? { empilhado: true, dados: [...(varias ? [{ rotulo: "Parcela", valor: i.rotulo }] : []), { rotulo: "Boleto e Pix", valor: "emitidos no Banco Inter no momento do envio" }] }
        : {
            empilhado: true,
            dados: [
              ...(varias ? [{ rotulo: "Parcela", valor: i.rotulo }] : []),
              ...(i.pagamento?.linhaDigitavel ? [{ rotulo: "Linha digitável", valor: i.pagamento.linhaDigitavel, mono: true }] : []),
              ...(i.pagamento?.pixCopiaECola ? [{ rotulo: "Pix copia e cola", valor: i.pagamento.pixCopiaECola, mono: true, semLink: true }] : []),
            ],
          },
    ),
  ];
}

/** E-mail ao cliente (cobrança, lembrete, vencimento ou atraso). */
export function montarEmailCliente(dados: {
  tipo: Exclude<TipoEnvioCobranca, "escalonamento">;
  nomeCliente: string;
  itens: ItemEmailCobranca[];
  chavePix: string | null;
}): EmailCobrancaMontado {
  const { nomeCliente, itens, chavePix } = dados;
  // Cobrança, lembrete ou vencimento de quem também tem parcela vencida: dois blocos — o que vai vencer e as pendências.
  const aVencer = itens.filter((i) => i.dias <= 0);
  const vencidas = itens.filter((i) => i.dias > 0);
  if (dados.tipo !== "atraso" && aVencer.length && vencidas.length) return montarEmailLembreteComPendencias({ tipo: dados.tipo, nomeCliente, aVencer, vencidas, chavePix });
  const varias = itens.length > 1;
  // Só vencidas na lista: o e-mail é de atraso mesmo que a etapa do dia seja um lembrete.
  const tipo = vencidas.length ? "atraso" : dados.tipo;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const primeiro = itens[0];
  const maiorAtraso = Math.max(...itens.map((i) => i.dias));
  const pix = chavePix ? [{ paragrafo: "Se preferir pagar por Pix, use a chave abaixo e informe o valor da parcela:" }, { dados: [{ rotulo: "Chave Pix", valor: chavePix, mono: true }] }] : [];

  let assunto: string;
  let titulo: string;
  let abertura: string;
  let fechamento: string;
  const comBoleto = itens.some((i) => i.pagamento);
  if (tipo === "cobranca") {
    assunto = varias ? "Cobrança Footlink: parcelas a vencer" : `Cobrança Footlink: parcela com vencimento em ${data(primeiro.vencimento)}`;
    titulo = varias ? "Suas cobranças do Footlink" : "Sua cobrança do Footlink";
    abertura = `Olá, ${nomeCliente}! Segue a cobrança ${varias ? "das próximas parcelas" : "da próxima parcela"} do seu contrato Footlink:`;
    fechamento = `O boleto em PDF segue anexo${varias ? " (um por parcela)" : ""} — o QR Code do Pix está no próprio boleto. Se o pagamento já foi feito, pode desconsiderar este e-mail.`;
  } else if (tipo === "lembrete") {
    assunto = varias ? "Lembrete: parcelas do Footlink a vencer" : `Lembrete: parcela do Footlink vence em ${data(primeiro.vencimento)}`;
    titulo = varias ? "Suas parcelas do Footlink vão vencer" : `Sua parcela do Footlink vence em ${data(primeiro.vencimento)}`;
    abertura = `Olá, ${nomeCliente}! Este é um lembrete ${varias ? "das próximas parcelas" : "da próxima parcela"} do seu contrato Footlink:`;
    fechamento = comBoleto
      ? "Se o pagamento já foi feito, pode desconsiderar este aviso."
      : "O boleto ou os dados para pagamento foram enviados pelo nosso financeiro. Se o pagamento já foi feito, pode desconsiderar este aviso.";
  } else if (tipo === "vencimento") {
    assunto = varias ? "Parcelas do Footlink vencem hoje" : "Sua parcela do Footlink vence hoje";
    titulo = varias ? "Suas parcelas do Footlink vencem hoje" : "Sua parcela do Footlink vence hoje";
    abertura = `Olá, ${nomeCliente}! Lembramos que ${varias ? "as parcelas abaixo vencem" : "a parcela abaixo vence"} hoje:`;
    fechamento = "Se o pagamento já foi feito, pode desconsiderar este aviso.";
  } else if (maiorAtraso <= ATRASO_TOM_LEVE_DIAS) {
    assunto = varias ? "Parcelas do Footlink em aberto" : `Parcela do Footlink em aberto (venceu em ${data(primeiro.vencimento)})`;
    titulo = "Não identificamos o seu pagamento";
    abertura = `Olá, ${nomeCliente}! Até o momento não identificamos o pagamento ${varias ? "das parcelas abaixo" : "da parcela abaixo"}:`;
    fechamento =
      "Se o pagamento já foi feito, pode desconsiderar este aviso — a confirmação pode levar até 2 dias úteis. Caso contrário, pedimos que regularize assim que possível. Se não recebeu os dados para pagamento, é só responder este e-mail que enviamos novamente.";
  } else {
    assunto = varias ? "Pendência financeira no seu contrato Footlink" : `Pendência: parcela do Footlink vencida em ${data(primeiro.vencimento)}`;
    titulo = "Há uma pendência no seu contrato Footlink";
    abertura = `Olá, ${nomeCliente}! Não identificamos o pagamento ${varias ? "das parcelas abaixo" : "da parcela abaixo"}:`;
    fechamento =
      "Para manter o seu acesso ao Footlink sem interrupções, pedimos que regularize o pagamento. Se não recebeu os dados para pagamento, é só responder este e-mail que enviamos novamente. Se o pagamento já foi feito, envie o comprovante respondendo esta mensagem.";
  }

  const conteudo = {
    preheader: `${varias ? `${itens.length} parcelas` : primeiro.rotulo} · ${formatarMoeda(total)} · ${situacao(itens.reduce((m, i) => (i.dias > m.dias ? i : m)))}`,
    titulo,
    blocos: [
      { paragrafo: abertura },
      { tabela: tabelaParcelas(itens, varias) },
      ...blocosComoPagar(itens),
      ...pix,
      { paragrafo: fechamento },
    ],
    marca: MARCA_FOOTLINK,
  };
  const { html, texto } = montarEmail(conteudo);
  return { assunto, html, texto, anexos: [{ nome: "footlink-logo.png", base64: LOGO_FOOTLINK_BASE64, contentId: LOGO_FOOTLINK_CID }] };
}

/**
 * Lembrete (D-3) ou vencimento (D0) para cliente que também tem parcela vencida
 * desde a data de corte: primeiro o que vai vencer, depois "além desta(s)…" as
 * pendências, e o pedido de regularização (leve ou firme, pelo maior atraso).
 */
function montarEmailLembreteComPendencias(dados: {
  tipo: "cobranca" | "lembrete" | "vencimento";
  nomeCliente: string;
  aVencer: ItemEmailCobranca[];
  vencidas: ItemEmailCobranca[];
  chavePix: string | null;
}): EmailCobrancaMontado {
  const { tipo, nomeCliente, aVencer, vencidas, chavePix } = dados;
  const variasAVencer = aVencer.length > 1;
  const variasVencidas = vencidas.length > 1;
  const primeira = aVencer[0];
  const maiorAtraso = Math.max(...vencidas.map((i) => i.dias));
  const pix = chavePix ? [{ paragrafo: "Se preferir pagar por Pix, use a chave abaixo e informe o valor da parcela:" }, { dados: [{ rotulo: "Chave Pix", valor: chavePix, mono: true }] }] : [];

  const lembrete =
    tipo === "cobranca"
      ? {
          assunto: variasAVencer ? "Cobrança Footlink: parcelas a vencer" : `Cobrança Footlink: parcela com vencimento em ${data(primeira.vencimento)}`,
          titulo: variasAVencer ? "Suas cobranças do Footlink" : "Sua cobrança do Footlink",
          abertura: `Olá, ${nomeCliente}! Segue a cobrança ${variasAVencer ? "das próximas parcelas" : "da próxima parcela"} do seu contrato Footlink:`,
        }
      : tipo === "lembrete"
      ? {
          assunto: variasAVencer ? "Lembrete: parcelas do Footlink a vencer" : `Lembrete: parcela do Footlink vence em ${data(primeira.vencimento)}`,
          titulo: variasAVencer ? "Suas parcelas do Footlink vão vencer" : `Sua parcela do Footlink vence em ${data(primeira.vencimento)}`,
          abertura: `Olá, ${nomeCliente}! Este é um lembrete ${variasAVencer ? "das próximas parcelas" : "da próxima parcela"} do seu contrato Footlink:`,
        }
      : {
          assunto: variasAVencer ? "Parcelas do Footlink vencem hoje" : "Sua parcela do Footlink vence hoje",
          titulo: variasAVencer ? "Suas parcelas do Footlink vencem hoje" : "Sua parcela do Footlink vence hoje",
          abertura: `Olá, ${nomeCliente}! Lembramos que ${variasAVencer ? "as parcelas abaixo vencem" : "a parcela abaixo vence"} hoje:`,
        };
  const pendencias = `Além ${variasAVencer ? "destas parcelas" : "desta parcela"}, não identificamos o pagamento ${variasVencidas ? "das parcelas abaixo" : "da parcela abaixo"}:`;
  const fechamento =
    maiorAtraso <= ATRASO_TOM_LEVE_DIAS
      ? "Se o pagamento já foi feito, pode desconsiderar este aviso — a confirmação pode levar até 2 dias úteis. Caso contrário, pedimos que regularize assim que possível. Se não recebeu os dados para pagamento, é só responder este e-mail que enviamos novamente."
      : "Para manter o seu acesso ao Footlink sem interrupções, pedimos que regularize o pagamento das parcelas em aberto. Se não recebeu os dados para pagamento, é só responder este e-mail que enviamos novamente. Se o pagamento já foi feito, envie o comprovante respondendo esta mensagem.";

  const totalVencido = vencidas.reduce((s, i) => s + i.valor, 0);
  const { html, texto } = montarEmail({
    preheader: `${variasAVencer ? `${aVencer.length} parcelas` : primeira.rotulo} ${tipo === "vencimento" ? "vencem hoje" : "a vencer"} · ${formatarMoeda(totalVencido)} em aberto`,
    titulo: lembrete.titulo,
    blocos: [
      { paragrafo: lembrete.abertura },
      { tabela: tabelaParcelas(aVencer, false) },
      { paragrafo: pendencias },
      { tabela: tabelaParcelas(vencidas, true, "Total em aberto") },
      ...blocosComoPagar([...aVencer, ...vencidas]),
      ...pix,
      { paragrafo: fechamento },
    ],
    marca: MARCA_FOOTLINK,
  });
  return {
    assunto: `${lembrete.assunto} · há ${variasVencidas ? "parcelas" : "parcela"} em aberto`,
    html,
    texto,
    anexos: [{ nome: "footlink-logo.png", base64: LOGO_FOOTLINK_BASE64, contentId: LOGO_FOOTLINK_CID }],
  };
}

/** Aviso interno: cliente chegou ao escalonamento (D+15 por padrão). */
export function montarEmailEscalonamento(dados: { nomeCliente: string; itens: ItemEmailCobranca[]; contatoId: number }): EmailCobrancaMontado {
  const { nomeCliente, itens } = dados;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const maiorAtraso = Math.max(...itens.map((i) => i.dias));
  const assunto = `Cobrança escalonada · ${nomeCliente} · ${maiorAtraso} dias de atraso`;
  const { html, texto } = montarEmail({
    preheader: `${nomeCliente}: ${formatarMoeda(total)} em atraso — a régua automática já enviou os avisos.`,
    titulo: "Cliente precisa de contato da equipe",
    blocos: [
      { paragrafo: `${nomeCliente} segue com pagamento em atraso depois dos avisos automáticos da régua. A partir daqui o acompanhamento é da equipe.` },
      { tabela: tabelaParcelas(itens, true, "Total em atraso") },
    ],
    botao: { rotulo: "Abrir a régua de cobrança", url: `${urlDoSistema()}/financeiro/cobranca?aba=clientes` },
    observacao: "Você recebe este aviso por estar na lista de escalonamento da régua de cobrança.",
  });
  return { assunto, html, texto, anexos: [{ nome: "footure-logo.png", base64: LOGO_EMAIL_BASE64, contentId: LOGO_EMAIL_CID }] };
}

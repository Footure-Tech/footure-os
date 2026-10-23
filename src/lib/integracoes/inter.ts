// Banco Inter — API Cobrança v3 (boleto com QR Code Pix no mesmo documento),
// usada pela régua de cobrança do Footlink (Fase 2). Autenticação mTLS: o
// certificado e a chave da integração (Internet Banking do Inter → Nova
// Integração via API, permissões da "API Cobrança (Boleto + Pix)") vão em
// base64 nas variáveis INTER_CERT_BASE64 / INTER_KEY_BASE64; client
// credentials em INTER_CLIENT_ID / INTER_CLIENT_SECRET; a conta no header
// x-conta-corrente (INTER_CONTA_CORRENTE). O fetch do Node não aceita
// certificado de cliente — por isso node:https.
import { Agent, request } from "node:https";

const HOST = "cdpj.partners.bancointer.com.br";
const ESCOPOS = "boleto-cobranca.read boleto-cobranca.write";

function variavel(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`${nome} não configurada — integração com o Banco Inter indisponível.`);
  return valor;
}

let agente: Agent | null = null;
function agenteMtls(): Agent {
  agente ??= new Agent({
    cert: Buffer.from(variavel("INTER_CERT_BASE64"), "base64").toString("utf8"),
    key: Buffer.from(variavel("INTER_KEY_BASE64"), "base64").toString("utf8"),
    keepAlive: true,
  });
  return agente;
}

export function interConfigurado(): boolean {
  return ["INTER_CLIENT_ID", "INTER_CLIENT_SECRET", "INTER_CERT_BASE64", "INTER_KEY_BASE64", "INTER_CONTA_CORRENTE"].every((n) => !!process.env[n]?.trim());
}

function chamar(metodo: "GET" | "POST" | "PUT" | "DELETE", caminho: string, corpo?: string, headers: Record<string, string> = {}): Promise<{ status: number; texto: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: HOST, path: caminho, method: metodo, agent: agenteMtls(), headers: { ...headers, ...(corpo !== undefined ? { "Content-Length": String(Buffer.byteLength(corpo)) } : {}) } },
      (res) => {
        let texto = "";
        res.setEncoding("utf8");
        res.on("data", (parte) => (texto += parte));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, texto }));
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error(`Inter ${metodo} ${caminho}: sem resposta em 30 s`)));
    req.on("error", reject);
    req.end(corpo);
  });
}

// Token OAuth (client credentials) reaproveitado enquanto válido — vale 1 h; renova com 2 min de folga.
let tokenAtual: { valor: string; expiraEm: number } | null = null;
async function token(): Promise<string> {
  if (tokenAtual && Date.now() < tokenAtual.expiraEm - 120_000) return tokenAtual.valor;
  const corpo = new URLSearchParams({ client_id: variavel("INTER_CLIENT_ID"), client_secret: variavel("INTER_CLIENT_SECRET"), grant_type: "client_credentials", scope: ESCOPOS }).toString();
  const r = await chamar("POST", "/oauth/v2/token", corpo, { "Content-Type": "application/x-www-form-urlencoded" });
  if (r.status !== 200) throw new Error(`Inter: falha ao obter token (${r.status}): ${r.texto.slice(0, 300)}`);
  const j = JSON.parse(r.texto) as { access_token: string; expires_in: number };
  tokenAtual = { valor: j.access_token, expiraEm: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function api<T>(metodo: "GET" | "POST" | "PUT" | "DELETE", caminho: string, corpo?: unknown): Promise<T> {
  const r = await chamar(metodo, caminho, corpo !== undefined ? JSON.stringify(corpo) : undefined, {
    Authorization: `Bearer ${await token()}`,
    "x-conta-corrente": variavel("INTER_CONTA_CORRENTE"),
    ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`Inter ${metodo} ${caminho} retornou ${r.status}: ${r.texto.slice(0, 500)}`);
  return (r.texto ? JSON.parse(r.texto) : null) as T;
}

// ─────────────────────────── tipos ───────────────────────────

/** Situações da cobrança no Inter. RECEBIDO/MARCADO_RECEBIDO = paga; CANCELADO/EXPIRADO = não pode mais ser paga. */
export type SituacaoCobrancaInter = "A_RECEBER" | "ATRASADO" | "RECEBIDO" | "MARCADO_RECEBIDO" | "CANCELADO" | "EXPIRADO" | "FALHA_EMISSAO" | "EM_PROCESSAMENTO" | "PROTESTO";

export interface PagadorInter {
  cpfCnpj: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  nome: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep: string;
  email?: string;
}

export interface NovaCobrancaInter {
  /** Identificador nosso (até 15 caracteres) — volta nas consultas e no webhook. */
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string;
  /** Dias depois do vencimento em que o boleto ainda pode ser pago (0 a 60). */
  numDiasAgenda: number;
  pagador: PagadorInter;
  /** Percentual sobre o valor; null = sem multa. */
  multaPercentual: number | null;
  /** Percentual ao mês; null = sem juros. */
  jurosMensalPercentual: number | null;
  /** Até 5 linhas impressas no boleto (78 caracteres cada). */
  mensagem?: string[];
}

export interface CobrancaInter {
  codigoSolicitacao: string;
  seuNumero: string;
  situacao: SituacaoCobrancaInter;
  dataVencimento: string;
  valorNominal: number;
  valorTotalRecebido: number | null;
  dataSituacao: string | null;
  /** BOLETO ou PIX, quando recebida. */
  origemRecebimento: string | null;
  nossoNumero: string | null;
  linhaDigitavel: string | null;
  codigoBarras: string | null;
  pixCopiaECola: string | null;
  txid: string | null;
  /** Pagador como emitido — cruza os boletos emitidos à mão (seuNumero livre) com as parcelas do Bling. */
  pagador: { cpfCnpj: string; nome: string } | null;
}

interface CobrancaInterBruta {
  cobranca: {
    codigoSolicitacao: string;
    seuNumero?: string;
    situacao: SituacaoCobrancaInter;
    dataVencimento: string;
    valorNominal: string | number;
    valorTotalRecebido?: string | number;
    dataSituacao?: string;
    origemRecebimento?: string;
    pagador?: { cpfCnpj?: string; nome?: string };
  };
  boleto?: { nossoNumero?: string; linhaDigitavel?: string; codigoBarras?: string };
  pix?: { pixCopiaECola?: string; txid?: string };
}

function normalizar(b: CobrancaInterBruta): CobrancaInter {
  const recebido = b.cobranca.valorTotalRecebido;
  return {
    codigoSolicitacao: b.cobranca.codigoSolicitacao,
    seuNumero: b.cobranca.seuNumero ?? "",
    situacao: b.cobranca.situacao,
    dataVencimento: b.cobranca.dataVencimento,
    valorNominal: Number(b.cobranca.valorNominal),
    valorTotalRecebido: recebido === undefined || recebido === null || recebido === "" ? null : Number(recebido),
    dataSituacao: b.cobranca.dataSituacao ?? null,
    origemRecebimento: b.cobranca.origemRecebimento ?? null,
    nossoNumero: b.boleto?.nossoNumero ?? null,
    linhaDigitavel: b.boleto?.linhaDigitavel ?? null,
    codigoBarras: b.boleto?.codigoBarras ?? null,
    pixCopiaECola: b.pix?.pixCopiaECola ?? null,
    txid: b.pix?.txid ?? null,
    pagador: b.cobranca.pagador?.cpfCnpj ? { cpfCnpj: b.cobranca.pagador.cpfCnpj.replace(/\D/g, ""), nome: b.cobranca.pagador.nome ?? "" } : null,
  };
}

// ─────────────────────────── operações ───────────────────────────

/** Emite boleto + QR Code Pix. Devolve o código da solicitação; os dados do boleto e do Pix vêm na consulta. */
export async function emitirCobrancaInter(c: NovaCobrancaInter): Promise<string> {
  const p = c.pagador;
  const r = await api<{ codigoSolicitacao: string }>("POST", "/cobranca/v3/cobrancas", {
    seuNumero: c.seuNumero.slice(0, 15),
    valorNominal: Number(c.valorNominal.toFixed(2)),
    dataVencimento: c.dataVencimento,
    numDiasAgenda: c.numDiasAgenda,
    pagador: {
      cpfCnpj: p.cpfCnpj.replace(/\D/g, ""),
      tipoPessoa: p.tipoPessoa,
      nome: p.nome.slice(0, 100),
      endereco: p.endereco.slice(0, 100),
      numero: p.numero?.slice(0, 10) || undefined,
      complemento: p.complemento?.slice(0, 30) || undefined,
      bairro: p.bairro?.slice(0, 60) || undefined,
      cidade: p.cidade.slice(0, 60),
      uf: p.uf.toUpperCase(),
      cep: p.cep.replace(/\D/g, ""),
      email: p.email || undefined,
    },
    multa: c.multaPercentual ? { codigo: "PERCENTUAL", taxa: c.multaPercentual } : undefined,
    mora: c.jurosMensalPercentual ? { codigo: "TAXAMENSAL", taxa: c.jurosMensalPercentual } : undefined,
    mensagem: c.mensagem?.length ? Object.fromEntries(c.mensagem.slice(0, 5).map((l, i) => [`linha${i + 1}`, l.slice(0, 78)])) : undefined,
  });
  return r.codigoSolicitacao;
}

export async function consultarCobrancaInter(codigoSolicitacao: string): Promise<CobrancaInter> {
  return normalizar(await api<CobrancaInterBruta>("GET", `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}`));
}

/** PDF do boleto (base64), para anexar ao e-mail. */
export async function pdfCobrancaInter(codigoSolicitacao: string): Promise<string> {
  return (await api<{ pdf: string }>("GET", `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}/pdf`)).pdf;
}

export async function cancelarCobrancaInter(codigoSolicitacao: string, motivo: string): Promise<void> {
  await api("POST", `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}/cancelar`, { motivoCancelamento: motivo.slice(0, 50) });
}

/** Cobranças por período (vencimento, emissão ou pagamento), página a página (até 1000 por página). */
export async function listarCobrancasInter(filtro: { de: string; ate: string; por: "VENCIMENTO" | "EMISSAO" | "PAGAMENTO"; situacao?: SituacaoCobrancaInter }): Promise<CobrancaInter[]> {
  const todas: CobrancaInter[] = [];
  for (let pagina = 0; pagina < 50; pagina++) {
    const q = new URLSearchParams({ dataInicial: filtro.de, dataFinal: filtro.ate, filtrarDataPor: filtro.por, itensPorPagina: "1000", paginaAtual: String(pagina) });
    if (filtro.situacao) q.set("situacao", filtro.situacao);
    const r = await api<{ cobrancas?: CobrancaInterBruta[]; totalPaginas?: number }>("GET", `/cobranca/v3/cobrancas?${q}`);
    todas.push(...(r.cobrancas ?? []).map(normalizar));
    if (!r.totalPaginas || pagina + 1 >= r.totalPaginas) break;
  }
  return todas;
}

/** Endereço que o Inter chama a cada mudança de situação (pagamento, cancelamento, expiração). */
export async function registrarWebhookInter(url: string): Promise<void> {
  await api("PUT", "/cobranca/v3/cobrancas/webhook", { webhookUrl: url });
}

export async function consultarWebhookInter(): Promise<{ webhookUrl: string } | null> {
  try {
    return await api<{ webhookUrl: string }>("GET", "/cobranca/v3/cobrancas/webhook");
  } catch (e) {
    if (e instanceof Error && / 404:/.test(e.message)) return null;
    throw e;
  }
}

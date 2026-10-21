// Cadastro de cliente novo — na tela de Clientes ou no cadastro rápido do
// formulário de pedido — sempre passa por aqui, pra todo cliente local nascer
// vinculado a um contato do Bling (sem vínculo, o pedido aprovado não chega
// ao Bling — ver blingPedido.ts). O CNPJ é procurado AO VIVO no Bling (não no
// cache bling_contatos, que só tem quem já tem pedido de venda):
// • achou e os dados batem: só vincula;
// • achou e há divergência: devolve a comparação pra tela perguntar se
//   atualiza o Bling com o que foi informado ou se fica com os dados do Bling;
// • não achou: cadastra o contato no Bling e vincula.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { consultarBling, obterAccessTokenValido, requisicaoBling } from "@/lib/integracoes/bling";
import { formatarCnpj } from "@/lib/clientes/formatacao";

type Supa = SupabaseClient<Database>;

export interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
}

/** Escolha do usuário diante de divergência entre o informado e o Bling. */
export type DecisaoBling = "atualizar_bling" | "usar_bling";

export interface DivergenciaCampo {
  campo: keyof DadosEmpresa;
  rotulo: string;
  informado: string;
  bling: string;
}

export interface ContatoBlingEncontrado {
  id: number;
  dados: DadosEmpresa;
  divergencias: DivergenciaCampo[];
}

const ROTULOS: Array<[keyof DadosEmpresa, string]> = [
  ["razaoSocial", "Razão social"],
  ["nomeFantasia", "Nome fantasia"],
  ["endereco", "Logradouro"],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["cep", "CEP"],
  ["municipio", "Município"],
  ["uf", "UF"],
];

const digitos = (valor: string) => valor.replace(/\D/g, "");

/** CNPJ (14) ou CPF de agente pessoa física (11) — só dígitos. */
export function documentoValido(cnpj: string): string {
  const d = digitos(cnpj);
  if (d.length !== 14 && d.length !== 11) {
    throw new Error("Informe um CNPJ (14 dígitos) ou CPF (11 dígitos) válido. Cliente estrangeiro sem documento: cadastre direto no Bling e sincronize.");
  }
  if (!digitosVerificadoresOk(d)) {
    throw new Error(`${d.length === 14 ? "CNPJ" : "CPF"} ${formatarCnpj(d)} inválido (dígitos verificadores não conferem) — confira o número no cartão CNPJ/documento.`);
  }
  return d;
}

/** Mesmo cálculo que o Bling (e a Receita) usa — evita mandar um documento que ele vai recusar. */
function digitosVerificadoresOk(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  const calcular = (base: string, pesos: number[]) => {
    const resto = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0) % 11;
    return d.length === 14 ? (resto < 2 ? 0 : 11 - resto) : ((resto * 10) % 11) % 10;
  };
  if (d.length === 14) {
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calcular(d.slice(0, 12), p1);
    const d2 = calcular(d.slice(0, 12) + d1, [6, ...p1]);
    return d.endsWith(`${d1}${d2}`);
  }
  // CPF: soma × 10 mod 11 (resto 10 vira 0)
  const d1 = calcular(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcular(d.slice(0, 9) + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
}

export function cepValido(cep: string): string {
  const d = digitos(cep);
  if (d.length !== 8) throw new Error("CEP inválido — informe os 8 dígitos.");
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Comparação tolerante: caixa, acentos, espaços e pontuação do CEP não contam como divergência. */
function normalizar(campo: keyof DadosEmpresa, valor: string) {
  if (campo === "cep") return digitos(valor);
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function compararComBling(informado: DadosEmpresa, bling: DadosEmpresa): DivergenciaCampo[] {
  return ROTULOS.filter(([campo]) => normalizar(campo, informado[campo]) !== normalizar(campo, bling[campo])).map(([campo, rotulo]) => ({
    campo,
    rotulo,
    informado: informado[campo],
    bling: bling[campo],
  }));
}

interface ContatoBlingBruto {
  id: number;
  nome: string;
  fantasia?: string;
  numeroDocumento: string;
  endereco?: { geral?: Partial<Record<"endereco" | "numero" | "complemento" | "bairro" | "cep" | "municipio" | "uf", string>> };
  [outros: string]: unknown;
}

function dadosDoContato(c: ContatoBlingBruto): DadosEmpresa {
  const g = c.endereco?.geral ?? {};
  return {
    razaoSocial: c.nome ?? "",
    nomeFantasia: c.fantasia ?? "",
    cnpj: digitos(c.numeroDocumento ?? ""),
    endereco: g.endereco ?? "",
    numero: g.numero ?? "",
    complemento: g.complemento ?? "",
    bairro: g.bairro ?? "",
    cep: g.cep ?? "",
    municipio: g.municipio ?? "",
    uf: g.uf ?? "",
  };
}

async function buscarContatoPorDocumento(token: string, documento: string): Promise<ContatoBlingBruto | null> {
  const lista = await consultarBling<{ data: Array<{ id: number }> }>(token, `/contatos?numeroDocumento=${documento}`);
  const id = lista.data?.[0]?.id;
  if (!id) return null;
  return (await consultarBling<{ data: ContatoBlingBruto }>(token, `/contatos/${id}`)).data;
}

function enderecoGeral(d: DadosEmpresa) {
  return {
    endereco: d.endereco.trim(),
    numero: d.numero.trim(),
    complemento: d.complemento.trim(),
    bairro: d.bairro.trim(),
    cep: digitos(d.cep),
    municipio: d.municipio.trim(),
    uf: d.uf.trim().toUpperCase(),
  };
}

async function idTipoContatoCliente(token: string): Promise<number | null> {
  const tipos = await consultarBling<{ data: Array<{ id: number; descricao: string }> }>(token, "/contatos/tipos");
  return tipos.data?.find((t) => t.descricao.trim().toLowerCase() === "cliente")?.id ?? null;
}

async function criarContato(token: string, d: DadosEmpresa): Promise<number> {
  const idCliente = await idTipoContatoCliente(token);
  const criado = await requisicaoBling<{ data: { id: number } }>(token, "POST", "/contatos", {
    nome: d.razaoSocial.trim(),
    fantasia: d.nomeFantasia.trim(),
    situacao: "A",
    numeroDocumento: d.cnpj,
    tipo: d.cnpj.length === 14 ? "J" : "F",
    indicadorIe: 9, // não contribuinte — o financeiro ajusta no Bling se precisar
    endereco: { geral: enderecoGeral(d) },
    ...(idCliente ? { tiposContato: [{ id: idCliente }] } : {}),
  });
  const id = criado?.data?.id;
  if (!id) throw new Error("O Bling não devolveu o id do contato criado.");
  return id;
}

/** PUT substitui o contato inteiro — parte do que o Bling já tem (telefone, e-mail, IE, tipos…) e troca só identidade e endereço. */
async function atualizarContato(token: string, atual: ContatoBlingBruto, d: DadosEmpresa) {
  const { id, ...resto } = atual;
  await requisicaoBling(token, "PUT", `/contatos/${id}`, {
    ...resto,
    nome: d.razaoSocial.trim(),
    fantasia: d.nomeFantasia.trim(),
    endereco: { ...(atual.endereco ?? {}), geral: enderecoGeral(d) },
  });
}

/** Cliente local com o mesmo documento (salvo só com dígitos ou formatado). */
async function clienteLocalComDocumento(supabase: Supa, documento: string, ignorarClienteId?: string) {
  let consulta = supabase.from("clientes").select("id, razao_social, nome_fantasia").in("cnpj", [documento, formatarCnpj(documento)]);
  if (ignorarClienteId) consulta = consulta.neq("id", ignorarClienteId);
  const { data } = await consulta.limit(1).maybeSingle();
  return data ? { id: data.id, nome: data.nome_fantasia || data.razao_social } : null;
}

async function clienteLocalComContato(supabase: Supa, contatoId: number, ignorarClienteId?: string) {
  let consulta = supabase.from("clientes").select("id, razao_social, nome_fantasia").eq("bling_contato_id", contatoId);
  if (ignorarClienteId) consulta = consulta.neq("id", ignorarClienteId);
  const { data } = await consulta.limit(1).maybeSingle();
  return data ? { id: data.id, nome: data.nome_fantasia || data.razao_social } : null;
}

export interface VerificacaoCnpj {
  /** Já existe cliente no sistema com esse documento — não cadastrar de novo. */
  clienteLocal: { id: string; nome: string } | null;
  contatoBling: ContatoBlingEncontrado | null;
}

/** Consulta ao digitar o CNPJ: avisa cedo se já é cliente aqui ou se já existe no Bling. */
export async function verificarCnpj(supabase: Supa, cnpj: string, informado: DadosEmpresa, ignorarClienteId?: string): Promise<VerificacaoCnpj> {
  const documento = documentoValido(cnpj);
  const clienteLocal = await clienteLocalComDocumento(supabase, documento, ignorarClienteId);
  const token = await obterAccessTokenValido(supabase);
  const bruto = await buscarContatoPorDocumento(token, documento);
  if (!bruto) return { clienteLocal, contatoBling: null };
  const dados = dadosDoContato(bruto);
  return { clienteLocal, contatoBling: { id: bruto.id, dados, divergencias: compararComBling(informado, dados) } };
}

export type ResultadoVinculo =
  | { status: "vinculado"; contatoId: number; dados: DadosEmpresa }
  | { status: "divergente"; contato: ContatoBlingEncontrado };

/**
 * Garante o contato do Bling para os dados informados (ver o cabeçalho do
 * arquivo) e o deixa no cache bling_contatos (a FK de clientes.bling_contato_id
 * aponta pra lá). Devolve os dados finais que o cliente local deve gravar.
 * Erros (Bling desconectado, CNPJ recusado, cliente duplicado) são lançados.
 */
export async function garantirContatoBling(
  supabase: Supa,
  informado: DadosEmpresa,
  decisao?: DecisaoBling,
  ignorarClienteId?: string,
): Promise<ResultadoVinculo> {
  const documento = documentoValido(informado.cnpj);
  const dados: DadosEmpresa = { ...informado, cnpj: documento, cep: cepValido(informado.cep), uf: informado.uf.trim().toUpperCase() };

  const duplicado = await clienteLocalComDocumento(supabase, documento, ignorarClienteId);
  if (duplicado) throw new Error(`Já existe um cliente com este CNPJ no sistema: ${duplicado.nome}. Use o cadastro existente.`);

  const token = await obterAccessTokenValido(supabase);
  const existente = await buscarContatoPorDocumento(token, documento);

  let contatoId: number;
  let final = dados;
  if (existente) {
    const outro = await clienteLocalComContato(supabase, existente.id, ignorarClienteId);
    if (outro) throw new Error(`O contato do Bling com este CNPJ já está vinculado ao cliente ${outro.nome}.`);

    const doBling = dadosDoContato(existente);
    const divergencias = compararComBling(dados, doBling);
    if (divergencias.length > 0) {
      if (!decisao) return { status: "divergente", contato: { id: existente.id, dados: doBling, divergencias } };
      if (decisao === "atualizar_bling") {
        await atualizarContato(token, existente, dados);
      } else {
        // Fica com o Bling; campo vazio lá mantém o informado (o contrato precisa do endereço completo).
        final = Object.fromEntries(
          (Object.keys(dados) as Array<keyof DadosEmpresa>).map((k) => [k, doBling[k]?.trim() ? doBling[k] : dados[k]]),
        ) as unknown as DadosEmpresa;
        final = { ...final, cnpj: documento, cep: digitos(final.cep).length === 8 ? cepValido(final.cep) : final.cep };
      }
    }
    contatoId = existente.id;
  } else {
    contatoId = await criarContato(token, dados);
  }

  const { error } = await supabase
    .from("bling_contatos")
    .upsert({ id: contatoId, nome: final.razaoSocial.trim(), cnpj: documento, sincronizado_em: new Date().toISOString() });
  if (error) throw new Error(`Contato do Bling pronto (id ${contatoId}), mas falhou ao gravar o cache local: ${error.message}`);

  return { status: "vinculado", contatoId, dados: final };
}

/** Campos de empresa dos payloads dos formulários (cliente e cadastro rápido do pedido). */
export function dadosEmpresaDoPayload(p: {
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
}): DadosEmpresa {
  return {
    razaoSocial: p.razaoSocial,
    nomeFantasia: p.nomeFantasia ?? "",
    cnpj: p.cnpj,
    endereco: p.endereco,
    numero: p.numero,
    complemento: p.complemento ?? "",
    bairro: p.bairro,
    cep: p.cep,
    municipio: p.municipio,
    uf: p.uf,
  };
}

/** Colunas de identidade/endereço de `clientes` a partir dos dados finais do vínculo. */
export function linhaIdentidadeCliente(d: DadosEmpresa) {
  return {
    razao_social: d.razaoSocial.trim(),
    nome_fantasia: d.nomeFantasia.trim() || null,
    cnpj: d.cnpj,
    endereco: d.endereco.trim(),
    numero: d.numero.trim(),
    complemento: d.complemento.trim() || null,
    bairro: d.bairro.trim(),
    cep: d.cep,
    municipio: d.municipio.trim(),
    uf: d.uf.trim().toUpperCase(),
  };
}

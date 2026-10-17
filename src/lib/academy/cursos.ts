// Footure Academy · cursos: como os produtos do Bling viram cursos e edições
// (decisões de produto, out/2026).
//
// 1. Nome padronizado: variantes do mesmo produto (prefixo "Assinatura - ",
//    lotes/promoções, grafias diferentes) viram um nome só — REGRAS abaixo.
// 2. Edição: quando o nome traz o ano (ex.: "Certificação Executivo de Futebol
//    2026"), o nome já identifica a edição. Sem ano (ex.: SAF, Python para
//    Futebol), cada ciclo de vendas é uma edição — novo ciclo depois de mais de
//    INTERVALO_NOVO_CICLO dias sem venda — e o nome ganha o mês de início.
//    Cursos gravados (CURSOS_GRAVADOS) têm janela de vendas aberta: sem edição.
//    Sem ano e fora dessa lista (ex.: SAF): por ciclo.
// 3. Pedido com mais de um curso: cada curso é uma venda, com o valor do pedido
//    rateado pelo ticket médio de cada curso (vendas avulsas do mesmo curso).

/**
 * Cursos gravados, com janela de vendas aberta: sem edição (nunca divididos em
 * ciclos). Pelo nome padronizado. Inclui o grupo das vendas da Hotmart (sem curso).
 */
const CURSOS_GRAVADOS: RegExp[] = [
  /^especializa[çc][ãa]o footure agents$/i,
  /^an[áa]lise de (desempenho|mercado) no futebol$/i,
  /^tend[êe]ncias t[áa]ticas$/i,
  /^organiza[çc][ãa]o t[áa]tica\b/i,
  /^pergunte ao jogo [–-] a metodologia\b/i,
  /^pergunte aos dados\b/i,
  /^combo futebol pro\b/i,
  /^combo (inicia[çc][ãa]o|imers[ãa]o) na an[áa]lise$/i,
  /^gest[ãa]o de comunica[çc][ãa]o em futebol\b/i,
  /^skin in the game\b/i,
  /^a nova ind[úu]stria do futebol$/i,
  /^analista 2\.0\b/i,
  /^python para futebol$/i,
  /^hotmart\b/i,
];
const gravado = (curso: string) => CURSOS_GRAVADOS.some((r) => r.test(curso));
/** Nome do grupo das vendas da Hotmart (item genérico no Bling, sem o curso). */
export const CURSO_HOTMART = "Hotmart (curso não identificado)";

/** Dias sem venda que encerram um ciclo (edição) de curso sem ano no nome. */
const INTERVALO_NOVO_CICLO = 60;

/** Padronização de nomes: [padrão do produto, nome do curso]. Aplicadas em ordem, depois de tirar os prefixos. */
const REGRAS: Array<[RegExp, string]> = [
  [/^footure produtora\b/i, "Hotmart (curso não identificado)"],
  [/^SAF\b.*como fazer/i, "SAF: Como Fazer – Da Ideia ao Investimento"],
  [/^pergunte ao jogo 2\.0\b.*2024/i, "Pergunte ao Jogo 2.0 (2024)"],
  [/^especializa[çc][ãa]o[ -]an[áa]lise[ -]de[ -]dados([ -]no[ -]futebol)?[ -]2025$/i, "Especialização Análise de Dados no Futebol 2025"],
  [/^python para futebol\b/i, "Python para Futebol"],
  [/^especializa[çc][ãa]o ci[êe]ncia de dados no futebol (20)?24\/25$/i, "Especialização Ciência de Dados no Futebol 2024/25"],
];

/** Nome padronizado do curso a partir do nome de um item do pedido. */
export function nomePadronizado(item: string) {
  const nome = item
    .trim()
    .replace(/^assinatura\s*-\s*/i, "")
    .replace(/^curso( digital online)?\s+/i, "")
    // Lote/promoção da mesma edição: "… 2025 - Lote 1", "… - Promo 48h", "… (Promo Mulher Joga …)", "… x1".
    .replace(/\s*\((promo|lote)[^)]*\)\s*$/i, "")
    .replace(/\s*[-–]\s*(lote\s*\d+|promo\b.*)$/i, "")
    .replace(/\s+x\d+$/i, "")
    .trim();
  return REGRAS.find(([padrao]) => padrao.test(nome))?.[1] ?? nome;
}

/** Itens (cursos) de um pedido — o cache guarda as descrições unidas por " + ". */
export function itensDoPedido(produto: string) {
  return produto
    .split(" + ")
    .map((i) => i.trim())
    .filter(Boolean);
}

/** Identificador na URL. */
export function slugCurso(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MES_CURTO[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const diasEntre = (de: string, ate: string) => (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000;

/**
 * Valor de cada curso num pedido com mais de um: proporcional ao ticket médio
 * do curso (curso sem venda avulsa usa a média dos outros; nenhum, divide igual).
 */
export function ratearPedido(total: number, cursos: string[], ticketMedio: Map<string, number>): number[] {
  const conhecidos = cursos.map((c) => ticketMedio.get(c)).filter((t): t is number => !!t);
  const padrao = conhecidos.length ? conhecidos.reduce((s, t) => s + t, 0) / conhecidos.length : 1;
  const pesos = cursos.map((c) => ticketMedio.get(c) ?? padrao);
  const soma = pesos.reduce((s, p) => s + p, 0);
  const valores = pesos.map((p) => Math.round((total * p * 100) / soma) / 100);
  valores[valores.length - 1] = Math.round((total - valores.slice(0, -1).reduce((s, v) => s + v, 0)) * 100) / 100;
  return valores;
}

/**
 * Edição de cada venda: o nome padronizado quando ele tem ano; senão, o ciclo
 * de vendas ("<curso> · <mês/ano de início>"). Recebe nome padronizado e data
 * de cada venda; devolve o nome da edição na mesma ordem.
 */
export function edicoes(vendas: Array<{ curso: string; data: string }>): string[] {
  const resultado = new Array<string>(vendas.length);
  const porCurso = new Map<string, number[]>();
  vendas.forEach((v, i) => {
    if (/\b20\d{2}\b/.test(v.curso) || gravado(v.curso)) resultado[i] = v.curso;
    else porCurso.set(v.curso, [...(porCurso.get(v.curso) ?? []), i]);
  });
  for (const [curso, indices] of porCurso) {
    indices.sort((a, b) => vendas[a].data.localeCompare(vendas[b].data));
    let inicio = vendas[indices[0]].data;
    let anterior = inicio;
    for (const i of indices) {
      if (diasEntre(anterior, vendas[i].data) > INTERVALO_NOVO_CICLO) inicio = vendas[i].data;
      anterior = vendas[i].data;
      resultado[i] = `${curso} · ${mesAno(inicio)}`;
    }
  }
  return resultado;
}

/**
 * Edição de uma venda cancelada (aparece na lista de compradores, fora dos
 * totais): não cria nem une ciclos — vai para a edição do mesmo curso cujo
 * período de vendas (± INTERVALO_NOVO_CICLO dias) contém a data, a mais
 * próxima; sem nenhuma, o próprio mês da venda.
 */
export function edicaoDeCancelada(curso: string, data: string, conhecidas: Array<{ curso: string; nome: string; primeira: string; ultima: string }>) {
  if (/\b20\d{2}\b/.test(curso) || gravado(curso)) return curso;
  const distancia = (e: { primeira: string; ultima: string }) =>
    data < e.primeira ? diasEntre(data, e.primeira) : data > e.ultima ? diasEntre(e.ultima, data) : 0;
  const candidata = conhecidas
    .filter((e) => e.curso === curso && distancia(e) <= INTERVALO_NOVO_CICLO)
    .sort((a, b) => distancia(a) - distancia(b))[0];
  return candidata?.nome ?? `${curso} · ${mesAno(data)}`;
}

// Comparação de duas versões do contrato (.docx): extrai o texto parágrafo a
// parágrafo (mammoth), alinha os parágrafos iguais (LCS) e devolve o que foi
// alterado, incluído ou removido. Para "alterado", isola o trecho que mudou
// (prefixo/sufixo comuns removidos, com algumas palavras de contexto) — é esse
// trecho que vira ajuste do modelo (troca exata na geração, ver gerarContrato).
import mammoth from "mammoth";

export interface MudancaTexto {
  tipo: "alterado" | "incluido" | "removido";
  /** Cláusula/seção onde a mudança está (ex.: "DO PAGAMENTO · CLÁUSULA OITAVA"). */
  clausula: string | null;
  trechoOriginal: string;
  trechoNovo: string;
  /** Parágrafo inteiro antes/depois, para mostrar o contexto. */
  paragrafoOriginal: string;
  paragrafoNovo: string;
}

export async function extrairParagrafos(docx: Buffer): Promise<string[]> {
  const { value } = await mammoth.extractRawText({ buffer: docx });
  return value
    .split(/\n+/)
    .map((p) => p.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);
}

// "CLÁUSULA OITAVA:" / "Parágrafo 1º:" no início do parágrafo — rótulo em negrito,
// num run separado do texto (o contexto do trecho nunca atravessa o rótulo).
const ROTULO = /^((?:CLÁUSULA|Cláusula)\s+[A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?|Parágrafo\s+(?:[Úú]nico|\d+º?))\s*[:.–-]\s*/;
const eTitulo = (p: string) => p.length <= 80 && p === p.toUpperCase() && /[A-ZÀ-Ú]/.test(p) && !ROTULO.test(p);

function rotuloDe(p: string) {
  return p.match(ROTULO)?.[1] ?? null;
}

/** Pares (i, j) de parágrafos iguais na ordem — LCS clássico (contratos têm poucas centenas de parágrafos). */
function alinhar(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const pares: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pares.push([i, j]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return pares;
}

const CONTEXTO = 6; // palavras de contexto de cada lado do trecho alterado

/** Trecho que mudou entre dois parágrafos, com contexto, sem atravessar o rótulo da cláusula. */
function trechoAlterado(antes: string, depois: string): { original: string; novo: string } {
  const rotulo = antes.match(ROTULO)?.[0] ?? "";
  const corpoA = depois.startsWith(rotulo) ? antes.slice(rotulo.length) : antes;
  const corpoB = depois.startsWith(rotulo) ? depois.slice(rotulo.length) : depois;
  const a = corpoA.split(" ");
  const b = corpoB.split(" ");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const ini = Math.max(0, pre - CONTEXTO);
  const fimA = Math.min(a.length, a.length - suf + CONTEXTO);
  const fimB = Math.min(b.length, b.length - suf + CONTEXTO);
  return { original: a.slice(ini, fimA).join(" "), novo: b.slice(ini, fimB).join(" ") };
}

export function compararParagrafos(antes: string[], depois: string[]): MudancaTexto[] {
  const pares = alinhar(antes, depois);
  const mudancas: MudancaTexto[] = [];
  let titulo: string | null = null;
  const contexto = (p: string) => [titulo, rotuloDe(p)].filter(Boolean).join(" · ") || null;

  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pares, [antes.length, depois.length] as [number, number]]) {
    const removidos = antes.slice(i, pi);
    const incluidos = depois.slice(j, pj);
    // Bloco divergente: pareia removido[k] com incluído[k] como "alterado"; o que sobra é inclusão/remoção.
    const n = Math.min(removidos.length, incluidos.length);
    for (let k = 0; k < n; k++) {
      const { original, novo } = trechoAlterado(removidos[k], incluidos[k]);
      mudancas.push({ tipo: "alterado", clausula: contexto(incluidos[k]), trechoOriginal: original, trechoNovo: novo, paragrafoOriginal: removidos[k], paragrafoNovo: incluidos[k] });
    }
    for (const p of removidos.slice(n)) mudancas.push({ tipo: "removido", clausula: contexto(p), trechoOriginal: p, trechoNovo: "", paragrafoOriginal: p, paragrafoNovo: "" });
    for (const p of incluidos.slice(n)) mudancas.push({ tipo: "incluido", clausula: contexto(p), trechoOriginal: "", trechoNovo: p, paragrafoOriginal: "", paragrafoNovo: p });
    if (pi < antes.length && eTitulo(antes[pi])) titulo = antes[pi];
    i = pi + 1;
    j = pj + 1;
  }
  return mudancas;
}

export async function compararVersoes(anterior: Buffer, nova: Buffer): Promise<MudancaTexto[]> {
  const [a, b] = await Promise.all([extrairParagrafos(anterior), extrairParagrafos(nova)]);
  return compararParagrafos(a, b);
}

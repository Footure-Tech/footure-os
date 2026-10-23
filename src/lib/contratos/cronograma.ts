// Cronograma de parcelas do pedido (regra de out/2026) — fonte única para a
// tabela da Cláusula Oitava, o Parágrafo único e as contas a receber do Bling.
//
// • Janelas de serviço contadas a partir da ativação (= 1º pagamento): a
//   parcela k cobre de ativação + (k−1) meses até o dia anterior à seguinte.
// • 1ª parcela vence na ativação.
// • Vencimento padrão: aniversário da ativação (mesmo dia todo mês).
// • Dia específico (diaVencimento): da 2ª em diante, vence no dia escolhido
//   imediatamente anterior (ou igual) ao início da janela que paga —
//   pagamento antecipado. Trava: se a 2ª cairia a menos de 10 dias da 1ª,
//   todas da 2ª em diante passam para o mesmo dia do mês seguinte.
// • Dia inexistente no mês (29–31) vai para o último dia do mês, respeitando
//   ano bissexto; cada data é calculada a partir da ativação, nunca da
//   parcela anterior, para o ajuste de fevereiro não "grudar" nos meses
//   seguintes (31/01 → 28/02 → 31/03).
import type { Parcela } from "./parcelas";

/** Distância mínima entre a 1ª e a 2ª parcela quando há dia de vencimento específico. */
export const DIAS_MINIMOS_ENTRE_PRIMEIRAS = 10;

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const diasNoMes = (ano: number, mes0: number) => new Date(ano, mes0 + 1, 0).getDate();

/** Dia `dia` do mês (ano, mes0 + deslocamento), indo para o último dia quando ele não existe. */
function dataNoMes(ano: number, mes0: number, deslocamento: number, dia: number): Date {
  const total = mes0 + deslocamento;
  const a = ano + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return new Date(a, m, Math.min(dia, diasNoMes(a, m)));
}

const diasEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

function paraData(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function formatarDDMMAAAA(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fim da vigência padrão: início + 12 meses − 1 dia (25/10/2026 → 24/10/2027; 29/02/2028 → 27/02/2029). */
export function fimVigenciaPadrao(inicioISO: string, meses = 12): string {
  if (!inicioISO) return "";
  const ini = paraData(inicioISO);
  const fim = dataNoMes(ini.getFullYear(), ini.getMonth(), meses, ini.getDate());
  fim.setDate(fim.getDate() - 1);
  return paraISO(fim);
}

export interface ParcelaCronograma extends Parcela {
  vencimentoISO: string;
}

/**
 * @param ativacaoISO 1º pagamento (aaaa-mm-dd) — início da 1ª janela.
 * @param diaVencimento null = aniversário da ativação.
 */
export function gerarCronograma(ativacaoISO: string, n: number, diaVencimento: number | null): ParcelaCronograma[] {
  const ativ = paraData(ativacaoISO);
  const [ano, mes0, diaAtiv] = [ativ.getFullYear(), ativ.getMonth(), ativ.getDate()];
  const inicioJanela = (k: number) => dataNoMes(ano, mes0, k, diaAtiv); // k = 0 para a 1ª parcela

  const especifico = diaVencimento != null && diaVencimento !== diaAtiv;
  // Vencimento da parcela k ≥ 1 (0-based) com dia específico: o dia escolhido
  // no mês de início da janela, ou no anterior se ele cair depois do início.
  const vencimentoEspecifico = (k: number, extra: number) => {
    const ini = inicioJanela(k);
    const noMes = dataNoMes(ini.getFullYear(), ini.getMonth(), 0, diaVencimento!);
    return dataNoMes(ini.getFullYear(), ini.getMonth(), (noMes > ini ? -1 : 0) + extra, diaVencimento!);
  };
  const empurrar = especifico && n > 1 && diasEntre(ativ, vencimentoEspecifico(1, 0)) < DIAS_MINIMOS_ENTRE_PRIMEIRAS ? 1 : 0;

  return Array.from({ length: n }, (_, k) => {
    const ini = inicioJanela(k);
    const fim = inicioJanela(k + 1);
    fim.setDate(fim.getDate() - 1);
    const venc = k === 0 ? ativ : especifico ? vencimentoEspecifico(k, empurrar) : ini;
    return {
      numero: k + 1,
      mesVigencia: `${MESES[ini.getMonth()]}/${ini.getFullYear()}`,
      periodo: `${formatarDDMMAAAA(ini)} a ${formatarDDMMAAAA(fim)}`,
      vencimento: formatarDDMMAAAA(venc),
      vencimentoISO: paraISO(venc),
    };
  });
}

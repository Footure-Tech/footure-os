// Séries do relatório de vendas por curso — sem dependências de servidor
// (usado também nos gráficos, no cliente).

export interface PontoSerie {
  /** aaaa-mm-dd (dia, ou segunda-feira da semana). */
  chave: string;
  valor: number;
  quantidade: number;
}

const DIA = 86_400_000;
export const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
/** Segunda-feira da semana da data. */
export const inicioDaSemana = (iso: string) => somarDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

export function agruparSemanal(diaria: PontoSerie[]): PontoSerie[] {
  const semanas = new Map<string, PontoSerie>();
  for (const d of diaria) {
    const chave = inicioDaSemana(d.chave);
    const s = semanas.get(chave) ?? { chave, valor: 0, quantidade: 0 };
    s.valor += d.valor;
    s.quantidade += d.quantidade;
    semanas.set(chave, s);
  }
  return [...semanas.values()];
}

/** dd/mm/aa */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

"use client";

import { Fragment, useState } from "react";
import { MdChevronRight } from "react-icons/md";
import type { LinhaDre } from "@/lib/controladoria/dre";
import { rotuloMes } from "@/lib/controladoria/modelo";
import { formatarMoedaCompacta } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const valor = (v: number) => (Math.abs(v) < 0.5 ? "—" : formatarMoedaCompacta(v));
const pct = (v: number, base: number) => (base ? `${((v / base) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** DRE mês a mês; cada grupo abre o detalhe (nível seguinte do plano de contas do Bling). */
export function TabelaDre({ meses, linhas, receitaTotal }: { meses: string[]; linhas: LinhaDre[]; receitaTotal: number }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (chave: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  return (
    <Table minWidth={1300}>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 min-w-[300px] bg-card">Linha</TableHead>
          {meses.map((m) => (
            <TableHead key={m} className="text-right">
              {rotuloMes(m)}
            </TableHead>
          ))}
          <TableHead className="text-right">12 meses</TableHead>
          <TableHead className="text-right">% receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l) => {
          const aberto = abertos.has(l.chave);
          const subtotal = l.tipo === "subtotal";
          return (
            <Fragment key={l.chave}>
              <TableRow className={cn(subtotal && "bg-light/60")}>
                <TableCell className={cn("sticky left-0 z-10 bg-card", subtotal && "bg-light/60")}>
                  {l.detalhes.length ? (
                    <button type="button" onClick={() => alternar(l.chave)} className="flex items-center gap-1 text-left font-bold text-darkPurple1 hover:text-purple-text">
                      <MdChevronRight className={cn("size-4 shrink-0 transition-transform", aberto && "rotate-90")} />
                      {l.rotulo}
                    </button>
                  ) : (
                    <span className={cn("pl-5 font-bold", subtotal ? "text-darkPurple1" : "text-gray2")}>{l.rotulo}</span>
                  )}
                </TableCell>
                {l.valores.map((v, i) => (
                  <TableCell key={meses[i]} className={cn("text-right whitespace-nowrap", subtotal ? "font-bold" : "font-semibold", v < 0 && subtotal ? "text-red" : "text-darkPurple1")}>
                    {valor(v)}
                  </TableCell>
                ))}
                <TableCell className={cn("text-right font-extrabold whitespace-nowrap", l.total < 0 && subtotal ? "text-red" : "text-darkPurple1")}>{valor(l.total)}</TableCell>
                <TableCell className="text-right text-xs text-gray2">{pct(l.total, receitaTotal)}</TableCell>
              </TableRow>
              {aberto &&
                l.detalhes.map((d) => (
                  <TableRow key={`${l.chave}:${d.rotulo}`}>
                    <TableCell className="sticky left-0 z-10 bg-card pl-11 text-[13px] whitespace-normal text-gray2">{d.rotulo}</TableCell>
                    {d.valores.map((v, i) => (
                      <TableCell key={meses[i]} className="text-right text-[13px] whitespace-nowrap text-gray2">
                        {valor(v)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-[13px] font-semibold whitespace-nowrap text-gray2">{valor(d.total)}</TableCell>
                    <TableCell className="text-right text-xs text-gray3">{pct(d.total, receitaTotal)}</TableCell>
                  </TableRow>
                ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

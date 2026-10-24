// Teste golden da Controladoria (docs/financeiro/PLANO.md, fase A3): calcula a
// DRE gerencial a partir do cache do Bling (fin_lancamentos) e compara com o
// gabarito do kit (docs/financeiro/gabarito/*.json, gerado a partir dos
// exports do Bling). Grava docs/financeiro/DIVERGENCIAS.md.
//
// Uso: npx tsx --env-file=.env.local scripts/golden-financeiro.ts
// Só lê o banco (service role). Tolerância: R$ 1.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { carregarBaseControladoria } from "@/lib/controladoria/indicadores";
import { BUS, calcularDreGerencial } from "@/lib/controladoria/gerencial/dre";
import { calcularCaixaMensal } from "@/lib/controladoria/gerencial/caixa";

const RAIZ = path.resolve(import.meta.dirname, "..");
const GABARITO = path.join(RAIZ, "docs/financeiro/gabarito/dados_painel_2026-01_a_09.json");
const GABARITO_CAIXA = path.join(RAIZ, "docs/financeiro/gabarito/dados_caixa_2026-01_a_09.json");
const SAIDA = path.join(RAIZ, "docs/financeiro/DIVERGENCIAS.md");
// O gabarito é jan–set/2026: qualquer data de outubro fecha esses 9 meses.
const HOJE_DO_GABARITO = "2026-10-15";
const TOLERANCIA = 1;

type Linha = { label: string; level: number; vals: number[]; total: number; pid: number | null; id: number };
interface Gabarito {
  meses: string[];
  rev_bu_month: Record<string, number[]>;
  pl: Record<string, Record<string, number>>;
  comp: Record<string, number>;
  params: Record<string, number>;
  dre_full: Linha[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normal = (s: string) => s.replace("(−)", "(-)").replace(/\s+/g, " ").trim();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Rode com --env-file=.env.local (faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  const supabase = createClient<Database>(url, chave, { auth: { persistSession: false } });

  const base = await carregarBaseControladoria(supabase);
  const sis = calcularDreGerencial(base, HOJE_DO_GABARITO);
  const gab = JSON.parse(fs.readFileSync(GABARITO, "utf8")) as Gabarito;

  const linhas: { item: string; mes: string; kit: number; sistema: number }[] = [];
  const comparar = (item: string, kit: number[], sistema: number[]) => {
    kit.forEach((k, i) => linhas.push({ item, mes: gab.meses[i], kit: k, sistema: sistema[i] ?? 0 }));
    linhas.push({ item, mes: "Total", kit: kit.reduce((s, v) => s + v, 0), sistema: sistema.reduce((s, v) => s + v, 0) });
  };
  const doKit = (label: string, nivel?: number) => gab.dre_full.find((r) => normal(r.label) === normal(label) && (nivel === undefined || r.level === nivel));
  const doSis = (label: string, nivel?: number) => sis.dre_full.find((r) => normal(r.label) === normal(label) && (nivel === undefined || r.level === nivel));

  // 1. Receita por BU por mês e Vendas de serviços
  for (const b of BUS) comparar(`Receita · ${b}`, gab.rev_bu_month[b], sis.rev_bu_month[b]);
  const vk = doKit("Vendas de serviços", 1);
  const vs = doSis("Vendas de serviços", 1);
  if (vk) comparar("Vendas de serviços", vk.vals, vs?.vals ?? []);

  // 2. Linhas-mestre da DRE e blocos de despesa (nível 0 e 1)
  for (const k of gab.dre_full.filter((r) => r.level <= 1)) {
    const s = doSis(k.label, k.level);
    comparar(`${k.level === 0 ? "" : "  · "}${normal(k.label)}`, k.vals, s?.vals ?? []);
  }

  // 3. Resultado por BU e KPIs (totais do período)
  const campos = ["receita", "imposto", "recliq", "custo_direto", "margem", "overhead", "resultado"] as const;
  const totais: { item: string; kit: number; sistema: number }[] = [];
  for (const b of BUS) for (const c of campos) totais.push({ item: `${b} · ${c}`, kit: gab.pl[b][c], sistema: sis.pl[b][c] });
  for (const c of campos) totais.push({ item: `Consolidado · ${c}`, kit: gab.comp[c], sistema: sis.comp[c as keyof typeof sis.comp] as number });
  for (const c of ["imp_efetivo_pct", "overhead_pct_op", "ebitda", "ebitda_margin", "dist_lucros"] as const) totais.push({ item: `KPI · ${c}`, kit: gab.params[c], sistema: sis.params[c] });

  const diverge = (k: number, s: number) => Math.abs(k - s) > TOLERANCIA;
  const divMes = linhas.filter((l) => diverge(l.kit, l.sistema));
  const divTot = totais.filter((t) => diverge(t.kit, t.sistema));

  // Diagnóstico de dados para explicar as diferenças
  const doPeriodo = base.lancamentos.filter((l) => (l.competencia ?? l.data_emissao ?? l.vencimento) >= "2026-01-01" && (l.competencia ?? l.data_emissao ?? l.vencimento) < "2026-10-01");
  const semDetalhe = doPeriodo.filter((l) => !l.detalhado_em);
  const semCategoria = doPeriodo.filter((l) => l.detalhado_em && !l.categoria_id);

  // ── Caixa mensal (balancete) ───────────────────────────────────────────
  const gc = JSON.parse(fs.readFileSync(GABARITO_CAIXA, "utf8")) as {
    serie: Record<"saldo_ini" | "saldo_fim" | "entradas" | "saidas" | "resultado", number[]>;
    macro: Record<string, number | null>;
    bu: { bu: string; receita: number; direto: number; margem: number; overhead: number; resultado: number }[];
  };
  const cx = calcularCaixaMensal(base, HOJE_DO_GABARITO);
  const linhasCaixa: { item: string; mes: string; kit: number; sistema: number }[] = [];
  for (const k of ["entradas", "saidas", "resultado", "saldo_ini", "saldo_fim"] as const) {
    gc.serie[k].forEach((v, i) => linhasCaixa.push({ item: `Caixa · ${k}`, mes: gab.meses[i], kit: v, sistema: cx.serie[k][i] }));
  }
  const offsetAbertura = gc.serie.saldo_ini[0] - cx.serie.saldo_ini[0];
  const totaisCaixa: { item: string; kit: number; sistema: number }[] = [];
  for (const k of ["resultado_caixa", "entradas", "saidas", "vendas_recebidas", "depositos", "distribuicao", "transferencias", "meses_neg", "burn3"] as const) {
    totaisCaixa.push({ item: `Caixa · ${k}`, kit: Number(gc.macro[k] ?? 0), sistema: Number(cx.macro[k as keyof typeof cx.macro] ?? 0) });
  }
  for (const b of gc.bu) {
    const s2 = cx.bu.find((x) => x.bu === b.bu)!;
    for (const c of ["receita", "direto", "margem", "overhead", "resultado"] as const) totaisCaixa.push({ item: `Caixa por BU · ${b.bu} · ${c}`, kit: b[c], sistema: s2[c] });
  }
  const divCxMes = linhasCaixa.filter((l) => diverge(l.kit, l.sistema));
  const divCxTot = totaisCaixa.filter((t) => diverge(t.kit, t.sistema));
  const fluxoOk = linhasCaixa.filter((l) => !l.item.includes("saldo")).every((l) => !diverge(l.kit, l.sistema));

  const md = [
    "# Divergências — teste golden da DRE (competência, jan–set/2026)",
    "",
    `> Gerado por \`scripts/golden-financeiro.ts\` em ${new Date().toLocaleString("pt-BR")}. Gabarito: \`docs/financeiro/gabarito/dados_painel_2026-01_a_09.json\` (kit sobre o \`dre.csv\` exportado do Bling). Tolerância de R$ ${TOLERANCIA}.`,
    "",
    "## Resumo",
    "",
    `- Comparações mês a mês: ${linhas.length} · divergentes: **${divMes.length}**`,
    `- Totais do período (resultado por BU e KPIs): ${totais.length} · divergentes: **${divTot.length}**`,
    `- Reconciliação BUs × Vendas de serviços (sistema): ${sis.reconciliacao.ok ? "ok" : `**falhou**, diferença de R$ ${brl(sis.reconciliacao.diferenca)}`}`,
    `- Lançamentos do período ainda **sem detalhe** (sem categoria carregada): ${semDetalhe.length} · R$ ${brl(semDetalhe.reduce((s, l) => s + l.valor, 0))}`,
    `- Lançamentos detalhados **sem categoria no Bling**: ${semCategoria.length} · R$ ${brl(semCategoria.reduce((s, l) => s + l.valor, 0))}`,
    `- Competência por fallback (emissão/vencimento): ${sis.premissas.fallbackCompetencia}`,
    `- Raízes fora de todos os blocos da DRE: ${sis.foraDaDre.map((r) => `${r.raiz} (R$ ${brl(r.total)})`).join(", ") || "nenhuma"}`,
    "",
    "## Divergências mês a mês",
    "",
    divMes.length ? "| Item | Mês | Kit (Bling) | Sistema | Diferença |\n|---|---|---:|---:|---:|" : "Nenhuma.",
    ...divMes.map((l) => `| ${l.item} | ${l.mes} | ${brl(l.kit)} | ${brl(l.sistema)} | ${brl(l.sistema - l.kit)} |`),
    "",
    "## Divergências nos totais do período",
    "",
    divTot.length ? "| Item | Kit (Bling) | Sistema | Diferença |\n|---|---:|---:|---:|" : "Nenhuma.",
    ...divTot.map((t) => `| ${t.item} | ${brl(t.kit)} | ${brl(t.sistema)} | ${brl(t.sistema - t.kit)} |`),
    "",
    "## Caixa mensal (balancete, jan–set/2026)",
    "",
    `- Movimentos de caixa carregados: ${base.movimentos.length} · sem detalhe no período: ${cx.semDetalhe}`,
    `- Abertura usada: saldos iniciais das contas R$ ${brl(cx.abertura.saldosIniciais)} + ajuste (premissa) R$ ${brl(cx.abertura.ajuste)}`,
    `- Diferença no saldo inicial de janeiro (kit − sistema): **R$ ${brl(offsetAbertura)}**${Math.abs(offsetAbertura) > TOLERANCIA ? ` → para fechar, o ajuste de abertura (premissa) deve ser R$ ${brl(cx.abertura.ajuste + offsetAbertura)}` : " (fecha)"}`,
    `- Fluxos (entradas, saídas, resultado) mês a mês: ${fluxoOk ? "**batem**" : "**divergem**"}`,
    "",
    divCxMes.length ? "| Item | Mês | Kit (Bling) | Sistema | Diferença |\n|---|---|---:|---:|---:|" : "Nenhuma divergência mês a mês.",
    ...divCxMes.map((l) => `| ${l.item} | ${l.mes} | ${brl(l.kit)} | ${brl(l.sistema)} | ${brl(l.sistema - l.kit)} |`),
    "",
    divCxTot.length ? "| Total do período | Kit (Bling) | Sistema | Diferença |\n|---|---:|---:|---:|" : "Totais do período: nenhuma divergência.",
    ...divCxTot.map((t) => `| ${t.item} | ${brl(t.kit)} | ${brl(t.sistema)} | ${brl(t.sistema - t.kit)} |`),
    "",
    "## Causa provável (preencher na análise)",
    "",
    "Para cada grupo de divergências: campo de data, situação do título, mapeamento de categoria, lançamento em categoria-pai, transferência, cancelamento, arredondamento ou dado no Bling. Não ajustar o cálculo para \"bater na marra\".",
    "",
  ].join("\n");
  fs.writeFileSync(SAIDA, md);
  console.log(`DRE — comparações: ${linhas.length + totais.length} · divergentes: ${divMes.length + divTot.length}`);
  console.log(`Caixa — comparações: ${linhasCaixa.length + totaisCaixa.length} · divergentes: ${divCxMes.length + divCxTot.length} · diferença de abertura: ${brl(offsetAbertura)}`);
  console.log(`Sem detalhe no período: ${semDetalhe.length} · relatório em ${path.relative(RAIZ, SAIDA)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// Resumo diário da Controladoria por e-mail para a Diretoria (spec §4.1):
// caixa, alertas críticos, novidades das últimas 24 h e a agenda do dia. Sai
// uma vez por dia (fin_resumos_diarios) e só quando há o que dizer.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { BlocoEmail } from "@/lib/email/layout";
import { urlDoSistema } from "@/lib/email/layout";
import { enviarEmailResumoControladoria } from "@/lib/integracoes/resend";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { calcularAgenda, calcularCaixa, carregarBaseControladoria } from "./indicadores";

type Supa = SupabaseClient<Database>;

const moeda = (v: number) => formatarMoeda(Math.round(v));
const ROTULO_SEVERIDADE = { critico: "Crítico", atencao: "Atenção", info: "Info" } as const;

export async function enviarResumoDiario(supabase: Supa, opcoes: { forcar?: boolean } = {}) {
  const hoje = hojeLocal();
  const base = await carregarBaseControladoria(supabase);
  if (!base.premissas.resumo_diario_ativo && !opcoes.forcar) return { enviado: false, motivo: "Resumo diário desligado nas premissas." };
  if (!opcoes.forcar) {
    const { data: jaEnviado } = await supabase.from("fin_resumos_diarios").select("data").eq("data", hoje).maybeSingle();
    if (jaEnviado) return { enviado: false, motivo: "Resumo de hoje já enviado." };
  }

  const ontem = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [{ data: abertos }, { data: diretoria }] = await Promise.all([
    supabase.from("fin_alertas").select("*").in("status", ["novo", "em_tratamento"]).order("criado_em", { ascending: false }),
    supabase.from("profiles").select("user_id").eq("papel", "admin").eq("ativo", true),
  ]);
  const criticos = (abertos ?? []).filter((a) => a.severidade === "critico");
  const novosAtencao = (abertos ?? []).filter((a) => a.severidade === "atencao" && a.criado_em >= ontem);
  const caixa = calcularCaixa(base, hoje);
  const agenda = calcularAgenda(base, hoje, 1);
  const pagarHoje = agenda.porDia[0].pagar;
  const receberHoje = agenda.porDia[0].receber;

  if (!criticos.length && !novosAtencao.length && !pagarHoje.length && !agenda.pagarVencidos.length && !opcoes.forcar) {
    return { enviado: false, motivo: "Nada a reportar hoje." };
  }

  const emails = (
    await Promise.all((diretoria ?? []).map(async (d) => (await supabase.auth.admin.getUserById(d.user_id)).data.user?.email ?? null))
  ).filter((e): e is string => !!e);
  if (!emails.length) return { enviado: false, motivo: "Nenhum usuário da Diretoria com e-mail." };

  const blocos: BlocoEmail[] = [];
  blocos.push({
    dados: [
      {
        rotulo: "Caixa disponível",
        valor: caixa.dataBase ? `${moeda(caixa.saldoHoje ?? caixa.caixa)} (saldos de ${formatarDataCurta(caixa.dataBase)})` : "saldos não informados",
      },
      ...(caixa.minimo ? [{ rotulo: "Menor saldo em 30 dias", valor: `${moeda(caixa.minimo.saldo)} em ${formatarDataCurta(caixa.minimo.data)}` }] : []),
      { rotulo: "Runway", valor: caixa.runwayMeses === null ? "geração de caixa positiva" : `${caixa.runwayMeses.toFixed(1).replace(".", ",")} meses` },
    ],
  });
  if (criticos.length) {
    blocos.push({ paragrafo: `Críticos em aberto (${criticos.length}):` });
    blocos.push({ tabela: { colunas: ["Alerta", "O que fazer"], linhas: criticos.slice(0, 10).map((a) => [a.titulo, a.acao]) } });
  }
  if (novosAtencao.length) {
    blocos.push({ paragrafo: `Novos nas últimas 24 horas (${novosAtencao.length}):` });
    blocos.push({ tabela: { colunas: ["Alerta", "Gravidade"], linhas: novosAtencao.slice(0, 10).map((a) => [a.titulo, ROTULO_SEVERIDADE[a.severidade]]) } });
  }
  const aPagar = [...agenda.pagarVencidos, ...pagarHoje];
  if (aPagar.length) {
    blocos.push({ paragrafo: "Pagamentos de hoje e vencidos:" });
    blocos.push({
      tabela: {
        colunas: ["Fornecedor", "Vencimento", "Valor"],
        linhas: aPagar.slice(0, 12).map((l) => [l.nome, formatarDataCurta(l.vencimento), moeda(l.aberto)]),
        total: { rotulo: aPagar.length > 12 ? `Total (${aPagar.length} contas)` : "Total", valor: moeda(aPagar.reduce((s, l) => s + l.aberto, 0)) },
      },
    });
  }
  if (receberHoje.length) {
    blocos.push({ paragrafo: `A receber hoje: ${moeda(receberHoje.reduce((s, l) => s + l.aberto, 0))} em ${receberHoje.length} ${receberHoje.length === 1 ? "parcela" : "parcelas"}.` });
  }

  const assunto = criticos.length
    ? `Controladoria · ${criticos.length} ${criticos.length === 1 ? "alerta crítico" : "alertas críticos"} · ${formatarDataCurta(hoje)}`
    : `Controladoria · resumo de ${formatarDataCurta(hoje)}`;
  const resendId = await enviarEmailResumoControladoria(emails, assunto, {
    preheader: criticos.length ? criticos[0].titulo : `Caixa e agenda de ${formatarDataCurta(hoje)}`,
    titulo: "Resumo financeiro do dia",
    blocos,
    botao: { rotulo: "Abrir a Controladoria", url: `${urlDoSistema()}/controladoria` },
    observacao: "Você recebe este resumo por ter o perfil Diretoria no Footure OS. Para desligar, use Controladoria › Premissas.",
  });
  const { error } = await supabase.from("fin_resumos_diarios").upsert({ data: hoje, destinatarios: emails, resend_id: resendId, enviado_em: new Date().toISOString() });
  if (error) console.error("[controladoria] resumo diário enviado, mas não registrado:", error.message);
  return { enviado: true, destinatarios: emails.length };
}

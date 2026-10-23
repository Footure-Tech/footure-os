// Motor de alertas da Controladoria (0061, spec §4). Roda depois de cada
// sincronização: calcula as condições a partir do cache e grava um alerta por
// condição (chave única). Condição que deixou de existir resolve o alerta
// sozinha; se voltar, o alerta reabre. Encerrado pela Diretoria fica encerrado
// enquanto a condição persistir.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinAlertaRow, GrupoAlerta, SeveridadeAlerta } from "@/lib/supabase/database.types";
import { formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import { hojeLocal } from "@/lib/financeiro/carteira";
import { calcularAgenda, calcularCaixa, calcularRecebiveis, calcularSaude, carregarBaseControladoria, type BaseControladoria, type Lancamento } from "./indicadores";
import { ROTULO_CAMADA, deslocarMes, diasEntre, emAberto, rotuloMes, somarDias } from "./modelo";

type Supa = SupabaseClient<Database>;

export interface CondicaoAlerta {
  chave: string;
  regra: string;
  grupo: GrupoAlerta;
  severidade: SeveridadeAlerta;
  titulo: string;
  descricao: string;
  acao: string;
  href: string | null;
  valor: number | null;
}

const PAINEL = "/controladoria";
const PAGAR = "/controladoria/pagar";
const PREMISSAS = "/controladoria/premissas";
const moeda = (v: number) => formatarMoeda(Math.round(v));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const soma = (itens: Lancamento[]) => itens.reduce((s, l) => s + l.aberto, 0);

/** Avalia todas as regras; pura (só lê a base). */
export function avaliarCondicoes(base: BaseControladoria, hoje = hojeLocal()): CondicaoAlerta[] {
  const p = base.premissas;
  const caixa = calcularCaixa(base, hoje);
  const receb = calcularRecebiveis(base, hoje);
  const agenda = calcularAgenda(base, hoje, 2);
  const saude = calcularSaude(base, hoje);
  const pagar = base.lancamentos.filter((l) => l.tipo === "pagar");
  const c: CondicaoAlerta[] = [];

  // ── Caixa e liquidez ─────────────────────────────────────────────────────
  if (caixa.contasSemSaldo.length) {
    c.push({
      chave: "saldos_nao_informados",
      regra: "saldos_nao_informados",
      grupo: "caixa",
      severidade: caixa.dataBase ? "atencao" : "critico",
      titulo: caixa.dataBase ? "Há contas de caixa sem saldo informado" : "Informe os saldos das contas para ligar a projeção de caixa",
      descricao: `Sem saldo: ${caixa.contasSemSaldo.map((x) => x.descricao).join(", ")}. As contas da Footure no Bling são manuais, então o saldo vem de você.`,
      acao: "Informar os saldos de hoje em Premissas",
      href: PREMISSAS,
      valor: null,
    });
  }
  for (const conta of caixa.contasDesatualizadas) {
    c.push({
      chave: `conciliacao:${conta.id}`,
      regra: "conta_sem_conciliacao",
      grupo: "caixa",
      severidade: "atencao",
      titulo: `Saldo de ${conta.descricao} sem atualização há ${diasEntre(conta.saldo_informado_em!, hoje)} dias`,
      descricao: `Último saldo informado: ${moeda(conta.saldo_informado ?? 0)} em ${formatarDataCurta(conta.saldo_informado_em!)}. Com o saldo velho, a projeção de caixa perde precisão.`,
      acao: "Conferir o extrato e informar o saldo de hoje",
      href: PREMISSAS,
      valor: conta.saldo_informado,
    });
  }
  if (caixa.minimo && caixa.minimo.saldo < 0) {
    c.push({
      chave: "caixa_negativo_30d",
      regra: "caixa_negativo_30d",
      grupo: "caixa",
      severidade: "critico",
      titulo: `Caixa fica negativo em ${formatarDataCurta(caixa.minimo.data)}`,
      descricao: `Saldo projetado mínimo de ${moeda(caixa.minimo.saldo)} nos próximos 30 dias, contando só o que já está lançado no Bling (sem vendas novas e sem os recebíveis vencidos).`,
      acao: "Cobrar os maiores atrasados, adiar pagamentos não essenciais ou resgatar aplicações",
      href: PAINEL,
      valor: caixa.minimo.saldo,
    });
  } else if (caixa.minimo && caixa.colchao > 0 && caixa.minimo.saldo < caixa.colchao) {
    c.push({
      chave: "caixa_abaixo_colchao_30d",
      regra: "caixa_abaixo_colchao_30d",
      grupo: "caixa",
      severidade: "critico",
      titulo: `Caixa abaixo do colchão mínimo em ${formatarDataCurta(caixa.minimo.data)}`,
      descricao: `Saldo projetado de ${moeda(caixa.minimo.saldo)} contra um colchão de ${moeda(caixa.colchao)} (${p.colchao_meses} meses das saídas médias de ${moeda(caixa.saidasMedias)}).`,
      acao: "Planejar a reposição: cobrança dos atrasados, vendas do mês ou adiamento de pagamentos",
      href: PAINEL,
      valor: caixa.minimo.saldo - caixa.colchao,
    });
  }
  if (caixa.dataBase && caixa.runwayMeses !== null && caixa.runwayMeses < p.runway_alerta_meses) {
    c.push({
      chave: "runway_baixo",
      regra: "runway_baixo",
      grupo: "caixa",
      severidade: "critico",
      titulo: `Runway de ${caixa.runwayMeses.toFixed(1).replace(".", ",")} meses`,
      descricao: `Queima média de ${moeda(caixa.queima)} por mês (${caixa.mesesBase.map(rotuloMes).join(", ")}) para um caixa total de ${moeda(caixa.disponivel + caixa.liquidez + caixa.aplicacao)}.`,
      acao: "Revisar as maiores despesas e a meta de vendas dos próximos meses",
      href: PAGAR,
      valor: caixa.queima,
    });
  }
  if (caixa.dataBase && caixa.saidasMedias > 0 && caixa.disponivel > p.excedente_meses * caixa.saidasMedias) {
    const excedente = caixa.disponivel - p.excedente_meses * caixa.saidasMedias;
    c.push({
      chave: `excedente_parado:${hoje.slice(0, 7)}`,
      regra: "excedente_parado",
      grupo: "caixa",
      severidade: "info",
      titulo: `${moeda(excedente)} parados na conta corrente`,
      descricao: `O disponível passa de ${p.excedente_meses} meses de saídas. O excedente rende mais no fundo de ${ROTULO_CAMADA.liquidez.toLowerCase()}.`,
      acao: "Aplicar o excedente no Resgate 24h",
      href: PAINEL,
      valor: excedente,
    });
  }
  const queimaOuAperto = caixa.queima > 0 || (caixa.minimo !== null && caixa.minimo.saldo < caixa.colchao);
  for (const l of pagar.filter((l) => emAberto(l.situacao) && l.categoria?.distribuicaoLucros && l.vencimento <= somarDias(hoje, 30))) {
    if (!queimaOuAperto) break;
    c.push({
      chave: `distribuicao:${l.id}`,
      regra: "distribuicao_com_queima",
      grupo: "caixa",
      severidade: "critico",
      titulo: `Distribuição de lucros de ${moeda(l.aberto)} em ${formatarDataCurta(l.vencimento)} com caixa pressionado`,
      descricao:
        caixa.queima > 0
          ? `Os últimos 3 meses queimaram ${moeda(caixa.queima)} por mês em média.`
          : `O saldo projetado fica abaixo do colchão de ${moeda(caixa.colchao)}.`,
      acao: "Rever o valor ou a data da distribuição",
      href: PAGAR,
      valor: l.aberto,
    });
  }

  // ── Pagamentos ───────────────────────────────────────────────────────────
  for (const l of agenda.pagarVencidos) {
    c.push({
      chave: `pagar_vencida:${l.id}`,
      regra: "pagar_vencida",
      grupo: "pagamentos",
      severidade: "atencao",
      titulo: `Conta a pagar vencida: ${l.nome} · ${moeda(l.aberto)}`,
      descricao: `Venceu em ${formatarDataCurta(l.vencimento)}${l.categoria ? ` · ${l.categoria.caminho}` : ""}${l.historico ? ` · ${l.historico}` : ""}.`,
      acao: "Pagar, ou dar baixa no Bling se já foi paga",
      href: PAGAR,
      valor: l.aberto,
    });
  }
  const hojeAmanha = agenda.porDia.flatMap((d) => d.pagar);
  if (hojeAmanha.length) {
    c.push({
      chave: `pagamentos_do_dia:${hoje}`,
      regra: "pagamentos_do_dia",
      grupo: "pagamentos",
      severidade: "info",
      titulo: `${plural(hojeAmanha.length, "pagamento vence", "pagamentos vencem")} hoje ou amanhã · ${moeda(soma(hojeAmanha))}`,
      descricao: hojeAmanha
        .slice(0, 5)
        .map((l) => `${l.nome} (${moeda(l.aberto)})`)
        .join(", ")
        .concat(hojeAmanha.length > 5 ? "…" : ""),
      acao: "Aprovar os pagamentos ou adiar com justificativa",
      href: PAGAR,
      valor: soma(hojeAmanha),
    });
  }
  if (saude.semCategoria.length) {
    c.push({
      chave: "sem_categoria",
      regra: "sem_categoria",
      grupo: "pagamentos",
      severidade: "atencao",
      titulo: `${plural(saude.semCategoria.length, "lançamento sem categoria", "lançamentos sem categoria")} nos últimos 12 meses`,
      descricao: saude.semCategoria
        .slice(0, 5)
        .map((l) => `${l.tipo === "pagar" ? "Pagar" : "Receber"} · ${l.nome} · ${moeda(l.valor)} · ${formatarDataCurta(l.vencimento)}`)
        .join("; "),
      acao: "Categorizar no Bling (sem categoria, o resultado fica incompleto)",
      href: PAGAR,
      valor: saude.semCategoria.reduce((s, l) => s + l.valor, 0),
    });
  }

  // Despesa que subiu: último mês fechado contra a média dos 3 anteriores, por categoria.
  const ultimoMes = deslocarMes(hoje.slice(0, 7), -1);
  const anteriores = [2, 3, 4].map((n) => deslocarMes(hoje.slice(0, 7), -n));
  const porCategoriaMes = new Map<string, Map<string, number>>();
  for (const l of pagar) {
    if (!l.categoria || l.categoria.distribuicaoLucros || l.categoria.emprestimo) continue;
    const mes = l.vencimento.slice(0, 7);
    if (mes !== ultimoMes && !anteriores.includes(mes)) continue;
    const m = porCategoriaMes.get(l.categoria.caminho) ?? new Map<string, number>();
    m.set(mes, (m.get(mes) ?? 0) + l.valor);
    porCategoriaMes.set(l.categoria.caminho, m);
  }
  for (const [caminho, m] of porCategoriaMes) {
    if (!anteriores.every((mes) => (m.get(mes) ?? 0) > 0)) continue;
    const media = anteriores.reduce((s, mes) => s + m.get(mes)!, 0) / 3;
    const atual = m.get(ultimoMes) ?? 0;
    if (media < 1000 || atual <= media * (1 + p.despesa_subiu_pct / 100)) continue;
    c.push({
      chave: `despesa_subiu:${caminho}:${ultimoMes}`,
      regra: "despesa_subiu",
      grupo: "pagamentos",
      severidade: "atencao",
      titulo: `${caminho}: +${Math.round((atual / media - 1) * 100)}% em ${rotuloMes(ultimoMes)}`,
      descricao: `${moeda(atual)} contra a média de ${moeda(media)} em ${anteriores.map(rotuloMes).reverse().join(", ")}.`,
      acao: "Revisar o contrato ou o fornecedor dessa despesa",
      href: PAGAR,
      valor: atual - media,
    });
  }

  // Fornecedor novo: primeiro lançamento nos últimos 30 dias, acima do valor de referência.
  const primeiroPorContato = new Map<number, string>();
  for (const l of pagar) {
    if (!l.contato_id) continue;
    const data = l.data_emissao ?? l.vencimento;
    const atual = primeiroPorContato.get(l.contato_id);
    if (!atual || data < atual) primeiroPorContato.set(l.contato_id, data);
  }
  const desde30 = somarDias(hoje, -30);
  for (const [contatoId, primeiro] of primeiroPorContato) {
    if (primeiro < desde30) continue;
    const doContato = pagar.filter((l) => l.contato_id === contatoId);
    const total = doContato.reduce((s, l) => s + l.valor, 0);
    if (total < p.fornecedor_novo_valor) continue;
    c.push({
      chave: `fornecedor_novo:${contatoId}`,
      regra: "fornecedor_novo",
      grupo: "pagamentos",
      severidade: "info",
      titulo: `Fornecedor novo: ${doContato[0].nome} · ${moeda(total)}`,
      descricao: `${plural(doContato.length, "lançamento", "lançamentos")} desde ${formatarDataCurta(primeiro)}${doContato[0].categoria ? ` · ${doContato[0].categoria.caminho}` : ""}.`,
      acao: "Confirmar que a despesa foi aprovada",
      href: PAGAR,
      valor: total,
    });
  }

  // Possível duplicidade: mesmo fornecedor e valor com vencimentos próximos.
  const recentes = pagar.filter((l) => l.contato_id && l.vencimento >= somarDias(hoje, -30)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  for (let i = 0; i < recentes.length; i++) {
    for (let j = i + 1; j < recentes.length; j++) {
      const a = recentes[i];
      const b = recentes[j];
      if (diasEntre(a.vencimento, b.vencimento) > p.duplicidade_dias) break;
      if (a.contato_id !== b.contato_id || Math.abs(a.valor - b.valor) > 0.009) continue;
      c.push({
        chave: `duplicidade:${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`,
        regra: "duplicidade",
        grupo: "pagamentos",
        severidade: "atencao",
        titulo: `Possível pagamento em duplicidade: ${a.nome} · ${moeda(a.valor)}`,
        descricao: `Vencimentos em ${formatarDataCurta(a.vencimento)} e ${formatarDataCurta(b.vencimento)}${a.historico ? ` · ${a.historico}` : ""}.`,
        acao: "Conferir e cancelar a duplicata no Bling",
        href: PAGAR,
        valor: a.valor,
      });
    }
  }

  // Fatura de cartão lançada como um valor só.
  for (const mes of [deslocarMes(hoje.slice(0, 7), -1), hoje.slice(0, 7)]) {
    const faturas = pagar.filter((l) => l.categoria?.faturaCartao && l.vencimento.startsWith(mes));
    if (!faturas.length) continue;
    const total = faturas.reduce((s, l) => s + l.valor, 0);
    c.push({
      chave: `fatura_cartao:${mes}`,
      regra: "fatura_cartao",
      grupo: "pagamentos",
      severidade: "info",
      titulo: `Fatura de cartão de ${rotuloMes(mes)} sem abertura por categoria · ${moeda(total)}`,
      descricao: "A fatura entra como um valor só e esconde mídia, software e viagens. Sem abrir por categoria, o resultado subestima essas despesas.",
      acao: "Lançar os itens da fatura por categoria",
      href: PAGAR,
      valor: total,
    });
  }

  // ── Recebíveis ───────────────────────────────────────────────────────────
  if (receb.antigos.qtd) {
    c.push({
      chave: "receber_antigo",
      regra: "receber_antigo",
      grupo: "recebiveis",
      severidade: "atencao",
      titulo: `${moeda(receb.antigos.valor)} a receber vencidos há mais de ${p.receber_antigo_dias} dias`,
      descricao: `${plural(receb.antigos.qtd, "parcela", "parcelas")} em aberto no Bling. Quase sempre é baixa não registrada, contrato cancelado com parcelas abertas ou perda. Distorcem a inadimplência e a projeção.`,
      acao: "Sanear: dar baixa, cancelar ou provisionar como perda",
      href: "/inadimplencia",
      valor: receb.antigos.valor,
    });
  }
  if (receb.semCobranca.length) {
    c.push({
      chave: `sem_cobranca:${hoje}`,
      regra: "receber_sem_cobranca",
      grupo: "recebiveis",
      severidade: "atencao",
      titulo: `${plural(receb.semCobranca.length, "parcela vence", "parcelas vencem")} em até ${p.cobranca_antecedencia_dias} dias sem boleto ou Pix`,
      descricao: receb.semCobranca
        .slice(0, 5)
        .map((l) => `${l.nome} · ${moeda(l.aberto)} · ${formatarDataCurta(l.vencimento)}`)
        .join("; "),
      acao: "Emitir e enviar as cobranças",
      href: "/financeiro/cobranca",
      valor: soma(receb.semCobranca),
    });
  }

  // ── Integração ───────────────────────────────────────────────────────────
  const execucao = base.ultimaExecucao;
  if (execucao?.status === "erro") {
    c.push({
      chave: "sync_erro",
      regra: "sync_erro",
      grupo: "integracao",
      severidade: "critico",
      titulo: "A última sincronização financeira com o Bling falhou",
      descricao: execucao.erro ?? "Erro sem detalhe.",
      acao: "Rodar “Atualizar dados do Bling” no painel; se persistir, reconectar o Bling em Configurações",
      href: PAINEL,
      valor: null,
    });
  } else if (!execucao || Date.now() - Date.parse(execucao.terminado_em ?? execucao.iniciado_em) > 26 * 3_600_000) {
    c.push({
      chave: "sync_desatualizada",
      regra: "sync_desatualizada",
      grupo: "integracao",
      severidade: "critico",
      titulo: "Dados financeiros com mais de 24 horas",
      descricao: execucao ? `Última sincronização em ${formatarDataCurta(execucao.iniciado_em)}.` : "A sincronização financeira ainda não rodou.",
      acao: "Rodar “Atualizar dados do Bling” no painel",
      href: PAINEL,
      valor: null,
    });
  }
  if (base.pendentesDetalhe > 0) {
    c.push({
      chave: "detalhes_pendentes",
      regra: "detalhes_pendentes",
      grupo: "integracao",
      severidade: "info",
      titulo: `${plural(base.pendentesDetalhe, "lançamento ainda sem detalhe", "lançamentos ainda sem detalhe")} (categoria e conta)`,
      descricao: "A carga inicial é feita aos poucos, para respeitar o limite de chamadas do Bling. Cada sincronização detalha mais algumas centenas.",
      acao: "Rodar “Atualizar dados do Bling” até zerar (ou aguardar as sincronizações automáticas)",
      href: PAINEL,
      valor: null,
    });
  }

  return c;
}

/** Grava o resultado da avaliação: cria, atualiza, reabre e resolve alertas. */
export async function persistirAlertas(supabase: Supa, condicoes: CondicaoAlerta[], hoje = hojeLocal()) {
  const agora = new Date().toISOString();
  const { data: existentes, error } = await supabase.from("fin_alertas").select("*").neq("status", "resolvido");
  if (error) throw new Error(error.message);
  const abertos = new Map((existentes ?? []).map((a) => [a.chave, a as FinAlertaRow]));
  const resolvidos = new Map<string, string>();
  const chavesNovas = condicoes.map((x) => x.chave).filter((k) => !abertos.has(k));
  for (let i = 0; i < chavesNovas.length; i += 100) {
    const { data, error: e } = await supabase.from("fin_alertas").select("id, chave").eq("status", "resolvido").in("chave", chavesNovas.slice(i, i + 100));
    if (e) throw new Error(e.message);
    for (const a of data ?? []) resolvidos.set(a.chave, a.id);
  }
  const eventos: { alerta_id: string; tipo: "criado" | "reaberto" | "reativado" | "resolvido"; detalhe?: string }[] = [];
  let novos = 0;

  for (const cond of condicoes) {
    const conteudo = { regra: cond.regra, grupo: cond.grupo, severidade: cond.severidade, titulo: cond.titulo, descricao: cond.descricao, acao: cond.acao, href: cond.href, valor: cond.valor, visto_em: agora };
    const atual = abertos.get(cond.chave);
    if (atual) {
      // Adiamento vencido volta para a fila.
      const reativar = atual.status === "adiado" && (!atual.adiado_ate || atual.adiado_ate <= hoje);
      const { error: e } = await supabase
        .from("fin_alertas")
        .update({ ...conteudo, ...(reativar ? { status: atual.responsavel_id ? "em_tratamento" : "novo", adiado_ate: null } : {}), atualizado_em: agora })
        .eq("id", atual.id);
      if (e) throw new Error(e.message);
      if (reativar) eventos.push({ alerta_id: atual.id, tipo: "reativado", detalhe: "Prazo do adiamento venceu" });
      continue;
    }
    const resolvidoId = resolvidos.get(cond.chave);
    if (resolvidoId) {
      const { error: e } = await supabase
        .from("fin_alertas")
        .update({ ...conteudo, status: "novo", responsavel_id: null, adiado_ate: null, motivo: null, resolvido_em: null, atualizado_em: agora })
        .eq("id", resolvidoId);
      if (e) throw new Error(e.message);
      eventos.push({ alerta_id: resolvidoId, tipo: "reaberto", detalhe: "A condição voltou a ocorrer" });
      novos++;
      continue;
    }
    const { data: criado, error: e } = await supabase.from("fin_alertas").insert({ chave: cond.chave, ...conteudo }).select("id").single();
    if (e) throw new Error(e.message);
    eventos.push({ alerta_id: criado.id, tipo: "criado" });
    novos++;
  }

  const ativas = new Set(condicoes.map((x) => x.chave));
  const sumiram = (existentes ?? []).filter((a) => !ativas.has(a.chave));
  if (sumiram.length) {
    const { error: e } = await supabase
      .from("fin_alertas")
      .update({ status: "resolvido", resolvido_em: agora, atualizado_em: agora })
      .in("id", sumiram.map((a) => a.id));
    if (e) throw new Error(e.message);
    for (const a of sumiram) eventos.push({ alerta_id: a.id, tipo: "resolvido", detalhe: "A condição deixou de existir" });
  }
  for (let i = 0; i < eventos.length; i += 500) {
    const { error: e } = await supabase.from("fin_alerta_eventos").insert(eventos.slice(i, i + 500));
    if (e) throw new Error(e.message);
  }
  return { ativos: condicoes.length, novos, resolvidos: sumiram.length };
}

export async function avaliarAlertas(supabase: Supa) {
  const base = await carregarBaseControladoria(supabase);
  return persistirAlertas(supabase, avaliarCondicoes(base));
}

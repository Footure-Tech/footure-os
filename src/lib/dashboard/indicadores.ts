// Dashboard da Diretoria (handoff "Gestão · Indicadores do negócio"). Tudo
// derivado de dados reais: pedidos + transições (fluxo comercial/jurídico) e o
// cache do Bling (parcelas). Onde o protótipo usa um dado que o sistema não
// tem (leads, metas, outras linhas de receita), a tela sinaliza em vez de
// inventar — ver decisões do redesign.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StatusPedido } from "@/lib/supabase/database.types";
import { carregarBaseParcelas, hojeLocal, montarContratosDaBase, mrrDoContrato } from "@/lib/financeiro/carteira";
import { carregarInadimplencia } from "@/lib/inadimplencia/consultas";

type Supa = SupabaseClient<Database>;

export type Periodo = "mes" | "tri" | "12m";
export const MESES_POR_PERIODO: Record<Periodo, number> = { mes: 1, tri: 3, "12m": 12 };
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Primeiro dia (aaaa-mm-01) do mês deslocado `delta` meses a partir de `base`. */
function inicioDoMes(base: Date, delta: number) {
  const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Ordem do fluxo, para saber até onde cada pedido chegou (funil).
const ETAPA_DO_STATUS: Record<StatusPedido, number> = {
  rascunho: 0,
  em_aprovacao: 1,
  aprovado: 2,
  em_revisao_juridica: 2,
  pronto_para_assinatura: 2,
  enviado_para_assinatura: 3,
  assinado: 4,
  concluido: 4,
  cancelado: -1,
};
const ETAPAS_FUNIL = ["Pedidos criados", "Enviados para aprovação", "Aprovados", "Enviados para assinatura", "Contratos assinados"];

export interface PontoAtencao {
  tipo: "validacao" | "falha" | "assinatura_incompleta" | "aprovacao" | "assinatura" | "atraso";
  titulo: string;
  descricao: string;
  href: string;
}

export async function carregarDashboard(supabase: Supa, periodo: Periodo) {
  const agora = new Date();
  const hoje = hojeLocal();
  const nMeses = MESES_POR_PERIODO[periodo];
  const janela = { inicio: inicioDoMes(agora, -(nMeses - 1)), fim: inicioDoMes(agora, 1) };
  const anterior = { inicio: inicioDoMes(agora, -(2 * nMeses - 1)), fim: janela.inicio };
  const naJanela = (iso: string | null, j: { inicio: string; fim: string }) => !!iso && iso.slice(0, 10) >= j.inicio && iso.slice(0, 10) < j.fim;

  const [{ data: pedidosBrutos, error: erroPedidos }, { data: transicoes, error: erroTransicoes }, base] = await Promise.all([
    supabase
      .from("pedidos")
      .select(
        "id, status, valor_total, vigencia_inicio, vigencia_fim, criado_em, geracao_contrato_erro, bling_erro, bling_pedido_id, clientes(razao_social, nome_fantasia, logo_path), profiles!pedidos_vendedor_id_profiles_fkey(nome), contratos(versao, assinatura_incompleta)",
      ),
    supabase.from("transicoes").select("pedido_id, para, criado_em").order("criado_em"),
    carregarBaseParcelas(supabase),
  ]);
  if (erroPedidos) console.error("[dashboard] pedidos:", erroPedidos.message);
  if (erroTransicoes) console.error("[dashboard] transicoes:", erroTransicoes.message);
  // Inadimplência só de contratos ativos (vigência em curso) — mesma visão padrão da tela Inadimplência.
  const inadimplencia = await carregarInadimplencia(supabase, base, "ativos");

  const transicoesPorPedido = new Map<string, { para: StatusPedido; criado_em: string }[]>();
  for (const t of transicoes ?? []) transicoesPorPedido.set(t.pedido_id, [...(transicoesPorPedido.get(t.pedido_id) ?? []), t]);

  const pedidos = (pedidosBrutos ?? []).map((p) => {
    const cliente = p.clientes as unknown as { razao_social: string; nome_fantasia: string | null; logo_path: string | null } | null;
    const versoes = (p.contratos as unknown as { versao: number; assinatura_incompleta: boolean }[] | null) ?? [];
    const historico = transicoesPorPedido.get(p.id) ?? [];
    const ultima = (para: StatusPedido) => [...historico].reverse().find((t) => t.para === para)?.criado_em ?? null;
    const etapaMaxima = Math.max(ETAPA_DO_STATUS[p.status], ...historico.map((t) => ETAPA_DO_STATUS[t.para]));
    return {
      ...p,
      cliente: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
      logoPath: cliente?.logo_path ?? null,
      vendedor: (p.profiles as unknown as { nome: string } | null)?.nome ?? "Sem vendedor",
      contratoAtual: versoes.reduce<(typeof versoes)[number] | null>((m, c) => (!m || c.versao > m.versao ? c : m), null),
      assinadoEm: ultima("assinado"),
      emValidacaoDesde: ultima("em_revisao_juridica"),
      etapaMaxima,
    };
  });

  // Receita do período = parcelas do Bling por VENCIMENTO (mesma regra do
  // gráfico Receita mensal, fora as de pedido cancelado): prevista = tudo que
  // vence no período; realizada = o que disso já foi pago. A variação compara
  // a prevista com a do período anterior de mesmo tamanho.
  const parcelasValidas = base.parcelas.filter((p) => !base.deCancelado(p));
  const somaVencendo = (j: { inicio: string; fim: string }, pagas = false) =>
    parcelasValidas.filter((p) => naJanela(p.vencimento, j) && (!pagas || p.situacao === "recebida")).reduce((s, p) => s + p.valor, 0);
  const receitaPrevista = somaVencendo(janela);
  const receitaRealizada = somaVencendo(janela, true);
  const receitaPrevistaAnterior = somaVencendo(anterior);
  // Contratos = pedidos de venda do Bling (a maioria nunca passou pelo fluxo da plataforma); MRR pelos ativos hoje.
  const contratosBling = montarContratosDaBase(base, hoje).filter((c) => c.situacao !== "cancelado");
  // Vendas = valor dos pedidos de venda do Bling pela DATA DA VENDA no período.
  const somaValorContratos = (lista: typeof contratosBling) => lista.reduce((s, c) => s + c.valorTotal, 0);
  const vendidosNaJanela = contratosBling.filter((c) => naJanela(c.dataVenda, janela));
  const vendasAnterior = somaValorContratos(contratosBling.filter((c) => naJanela(c.dataVenda, anterior)));
  // Divisão por perfil do cliente cadastrado (clientes.tipo); contato sem cadastro fica à parte.
  const perfilDo = (contatoId: number) => base.clientePorContato.get(contatoId)?.tipo ?? null;
  const porPerfil = <T,>(itens: T[], contatoId: (x: T) => number, valor: (x: T) => number) => {
    const r = { clube: 0, agente: 0, semPerfil: 0 };
    for (const x of itens) {
      const perfil = perfilDo(contatoId(x));
      r[perfil === "clube" ? "clube" : perfil === "agente" ? "agente" : "semPerfil"] += valor(x);
    }
    return r;
  };
  // Vigente = ativo e com o período (vigência ou estimativa pelas parcelas) cobrindo hoje — contrato já
  // encerrado que só ficou com parcela atrasada é inadimplência, não receita recorrente.
  const vigentes = contratosBling.filter((c) => c.ativo && !!c.inicio && c.inicio <= hoje && !!c.fim && c.fim >= hoje);
  // MRR: com vigência definida na plataforma, valor ÷ meses de vigência (cobre
  // à vista); sem ela, valor ÷ nº de parcelas (≈ a mensalidade do parcelado).
  const mrr = vigentes.reduce((s, c) => s + mrrDoContrato(c), 0);
  const mrrPorPerfil = porPerfil(vigentes, (c) => c.contatoId, mrrDoContrato);

  // Receita mensal (cache do Bling, por VENCIMENTO): 9 meses atrás até 2 à frente.
  const receitaMensal = Array.from({ length: 12 }, (_, i) => {
    const inicio = inicioDoMes(agora, i - 9);
    const chave = inicio.slice(0, 7);
    const doMes = parcelasValidas.filter((p) => p.vencimento.startsWith(chave));
    const [ano, mes] = chave.split("-").map(Number);
    return {
      chave,
      rotulo: MESES_CURTOS[mes - 1],
      rotuloCompleto: `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`,
      previsto: doMes.reduce((s, p) => s + p.valor, 0),
      realizado: doMes.filter((p) => p.situacao === "recebida").reduce((s, p) => s + p.valor, 0),
      futuro: chave > hoje.slice(0, 7),
    };
  });

  // Funil de pedidos (sem leads): coorte dos pedidos criados no período.
  const coorte = pedidos.filter((p) => naJanela(p.criado_em, janela));
  const funil = ETAPAS_FUNIL.map((rotulo, etapa) => ({ rotulo, quantidade: coorte.filter((p) => p.etapaMaxima >= etapa).length }));

  // Contratos próximos do vencimento — os 5 contratos do Bling ativos (vigência
  // definida ou estimada em curso, mesma regra de Financeiro · Contratos) que
  // terminam primeiro.
  const proximosDoVencimento = contratosBling
    .filter((c) => c.ativo && !!c.fim && c.fim >= hoje)
    .sort((a, b) => a.fim!.localeCompare(b.fim!))
    .slice(0, 5)
    .map((c) => ({
      id: c.pedidoId,
      cliente: c.cliente,
      logoPath: c.logoPath,
      numeroPedido: c.numeroPedido,
      valor: c.valorTotal,
      fim: c.fim!,
      diasParaVencer: Math.round((Date.parse(`${c.fim}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000),
      vigenciaDefinida: c.vigenciaDefinida,
    }));

  // Fluxo (layout B)
  const somaValor = (lista: typeof pedidos) => lista.reduce((s, p) => s + Number(p.valor_total), 0);
  const porStatus = (...status: StatusPedido[]) => pedidos.filter((p) => status.includes(p.status));
  const aReceber = base.parcelas.filter((p) => p.situacao === "em_aberto" || p.situacao === "atrasada");
  const fluxo = [
    { rotulo: "Pedidos", lista: porStatus("rascunho"), sub: "rascunhos com o comercial", href: "/admin?aba=rascunho" },
    { rotulo: "Aprovação", lista: porStatus("em_aprovacao"), sub: "aguardando a diretoria", href: "/admin?aba=aprovacao" },
    { rotulo: "Contratos", lista: porStatus("aprovado", "em_revisao_juridica", "pronto_para_assinatura"), sub: "em geração ou validação", href: "/juridico?aba=validacao" },
    { rotulo: "Assinatura", lista: porStatus("enviado_para_assinatura"), sub: "aguardando na Clicksign", href: "/juridico?aba=assinatura" },
  ].map((b) => ({ rotulo: b.rotulo, quantidade: b.lista.length, valor: somaValor(b.lista), sub: b.sub, href: b.href }));
  fluxo.push({
    rotulo: "Parcelas",
    quantidade: new Set(aReceber.map((p) => p.contatoId)).size,
    valor: aReceber.reduce((s, p) => s + p.valor, 0),
    sub: "clientes com parcelas a receber",
    href: "/financeiro/pagamentos",
  });

  // Realizado por vendedor (não há metas cadastradas): só pedidos fechados na
  // plataforma — o Bling não informa o vendedor do pedido de venda.
  const assinadosNaJanela = pedidos.filter((p) => naJanela(p.assinadoEm, janela));
  const porVendedor = new Map<string, { nome: string; valor: number; contratos: number }>();
  for (const p of assinadosNaJanela) {
    const atual = porVendedor.get(p.vendedor) ?? { nome: p.vendedor, valor: 0, contratos: 0 };
    porVendedor.set(p.vendedor, { ...atual, valor: atual.valor + Number(p.valor_total), contratos: atual.contratos + 1 });
  }
  const vendedores = [...porVendedor.values()].sort((a, b) => b.valor - a.valor);

  // Pontos de atenção — contratos em validação SEMPRE listados (decisão de produto).
  const pontos: PontoAtencao[] = [];
  for (const p of porStatus("em_revisao_juridica", "pronto_para_assinatura")) {
    pontos.push({
      tipo: "validacao",
      titulo: p.status === "pronto_para_assinatura" ? `Pronto para enviar à Clicksign · ${p.cliente}` : `Contrato em validação · ${p.cliente}`,
      descricao:
        p.status === "pronto_para_assinatura"
          ? "Validado pelo jurídico — falta disparar a assinatura."
          : `Aguardando validação jurídica${p.emValidacaoDesde ? ` desde ${p.emValidacaoDesde.slice(8, 10)}/${p.emValidacaoDesde.slice(5, 7)}` : ""}.`,
      href: `/juridico?aba=validacao&sel=${p.id}`,
    });
  }
  for (const p of pedidos.filter((x) => x.bling_erro && !x.bling_pedido_id && x.status !== "cancelado")) {
    pontos.push({ tipo: "falha", titulo: `Falha no envio ao Bling · ${p.cliente}`, descricao: p.bling_erro ?? "", href: `/pedidos/${p.id}` });
  }
  for (const p of pedidos.filter((x) => x.status === "aprovado" && x.geracao_contrato_erro)) {
    pontos.push({ tipo: "falha", titulo: `Falha ao gerar contrato · ${p.cliente}`, descricao: p.geracao_contrato_erro ?? "", href: `/pedidos/${p.id}` });
  }
  for (const p of pedidos.filter((x) => x.status === "enviado_para_assinatura" && x.contratoAtual?.assinatura_incompleta)) {
    pontos.push({
      tipo: "assinatura_incompleta",
      titulo: `Assinatura encerrada sem todos · ${p.cliente}`,
      descricao: "O prazo terminou com signatários pendentes — reenviar ou estender o prazo.",
      href: `/pedidos/${p.id}`,
    });
  }
  const aguardandoAprovacao = porStatus("em_aprovacao");
  if (aguardandoAprovacao.length > 0) {
    pontos.push({
      tipo: "aprovacao",
      titulo: `${aguardandoAprovacao.length} ${aguardandoAprovacao.length === 1 ? "pedido aguardando" : "pedidos aguardando"} aprovação`,
      descricao: `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(somaValor(aguardandoAprovacao))} para aprovar.`,
      href: "/admin?aba=aprovacao",
    });
  }
  const aguardandoAssinatura = porStatus("enviado_para_assinatura").filter((p) => !p.contratoAtual?.assinatura_incompleta);
  if (aguardandoAssinatura.length > 0) {
    pontos.push({
      tipo: "assinatura",
      titulo: `${aguardandoAssinatura.length} ${aguardandoAssinatura.length === 1 ? "contrato aguardando" : "contratos aguardando"} assinatura`,
      descricao: "Acompanhe quem falta assinar e reenvie o lembrete.",
      href: "/juridico?aba=assinatura",
    });
  }
  const maiorAtraso = [...inadimplencia.clientes].sort((a, b) => b.diasAtraso - a.diasAtraso)[0];
  if (maiorAtraso) {
    pontos.push({
      tipo: "atraso",
      titulo: `Maior atraso · ${maiorAtraso.nome}`,
      descricao: `${maiorAtraso.diasAtraso} dias · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(maiorAtraso.totalAtrasado)} em atraso.`,
      href: "/inadimplencia",
    });
  }

  return {
    temCacheBling: base.temCache,
    kpis: {
      receitaPrevista,
      receitaRealizada,
      variacaoReceita: receitaPrevistaAnterior > 0 ? (receitaPrevista - receitaPrevistaAnterior) / receitaPrevistaAnterior : null,
      mrr,
      contratosVigentes: vigentes.length,
      vendas: somaValorContratos(vendidosNaJanela),
      contratosVendidos: vendidosNaJanela.length,
      variacaoVendas: vendasAnterior > 0 ? (somaValorContratos(vendidosNaJanela) - vendasAnterior) / vendasAnterior : null,
      mrrPorPerfil,
      vendasPorPerfil: porPerfil(vendidosNaJanela, (c) => c.contatoId, (c) => c.valorTotal),
      vencidoPorPerfil: porPerfil(inadimplencia.clientes, (c) => c.contatoId, (c) => c.totalAtrasado),
      taxaInadimplencia: inadimplencia.resumo.taxa,
      vencido: inadimplencia.resumo.totalVencido,
    },
    receitaMensal,
    funil,
    proximosDoVencimento,
    faixas: inadimplencia.faixas,
    fluxo,
    vendedores,
    pontos,
  };
}

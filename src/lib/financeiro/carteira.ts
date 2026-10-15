// Tela Financeiro · Contratos e parcelas: tudo calculado a partir do cache
// do Bling (bling_contatos + bling_parcelas, gravados na sincronização) —
// nenhuma chamada ao Bling ao vivo. Ainda não há vínculo pedido -> Bling, então
// a "carteira" é por cliente (contato do Bling), não por contrato.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { classificarSituacaoParcela, type SituacaoParcela } from "@/lib/integracoes/bling";

type Supa = SupabaseClient<Database>;

export interface ParcelaCarteira {
  id: number;
  contatoId: number;
  numeroPedidoOrigem: string | null;
  vencimento: string;
  valor: number;
  situacao: SituacaoParcela;
  /** Posição da parcela dentro do pedido de origem no Bling (ordem de vencimento). */
  numero: number;
  totalDoPedido: number;
}

export interface ClienteCarteira {
  contatoId: number;
  clienteId: string | null;
  nome: string;
  logoPath: string | null;
  valorTotal: number;
  pagas: number;
  total: number;
  proximoVencimento: string | null;
  atrasado: boolean;
}

export interface ResumoFinanceiro {
  carteiraAtiva: number;
  clientesAtivos: number;
  previstoMes: number;
  aReceberMes: number;
  recebidoMes: number;
  vencido: number;
  clientesComVencido: number;
}

export function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const linhas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await consulta(pagina * 1000, pagina * 1000 + 999);
    if (error) {
      console.error("[financeiro/carteira]", error.message);
      break;
    }
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/** Base comum (Financeiro e Inadimplência): parcelas do cache já classificadas
 * e numeradas n/N, e o nome/logo/cadastro local de cada contato do Bling. */
export async function carregarBaseParcelas(supabase: Supa) {
  const [parcelasBrutas, contatos, clientesLocais] = await Promise.all([
    lerTudo((de, ate) => supabase.from("bling_parcelas").select("*").order("vencimento").range(de, ate)),
    lerTudo((de, ate) => supabase.from("bling_contatos").select("id, nome, sincronizado_em").range(de, ate)),
    lerTudo((de, ate) =>
      supabase.from("clientes").select("id, razao_social, nome_fantasia, logo_path, bling_contato_id").not("bling_contato_id", "is", null).range(de, ate),
    ),
  ]);

  const clientePorContato = new Map(clientesLocais.map((c) => [c.bling_contato_id!, c]));
  const contatoPorId = new Map(contatos.map((c) => [c.id, c]));

  // Numeração n/N dentro de cada pedido de origem (o Bling não devolve pronta).
  const grupos = new Map<string, typeof parcelasBrutas>();
  for (const p of parcelasBrutas) {
    const chave = `${p.contato_id}:${p.numero_pedido_origem ?? "avulsa"}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  const parcelas: ParcelaCarteira[] = [];
  for (const grupo of grupos.values()) {
    grupo.forEach((p, i) =>
      parcelas.push({
        id: p.id,
        contatoId: p.contato_id,
        numeroPedidoOrigem: p.numero_pedido_origem,
        vencimento: p.vencimento,
        valor: Number(p.valor),
        situacao: classificarSituacaoParcela(p.situacao, p.vencimento),
        numero: i + 1,
        totalDoPedido: grupo.length,
      }),
    );
  }

  const nomeDoContato = (id: number) => {
    const local = clientePorContato.get(id);
    return local?.nome_fantasia || local?.razao_social || contatoPorId.get(id)?.nome || "Cliente";
  };
  const sincronizadoEm = contatos.reduce<string | null>((max, c) => (!max || c.sincronizado_em > max ? c.sincronizado_em : max), null);

  return { parcelas, clientePorContato, nomeDoContato, sincronizadoEm, temCache: parcelasBrutas.length > 0 };
}

export async function carregarCarteira(supabase: Supa) {
  const { parcelas, clientePorContato, nomeDoContato, sincronizadoEm, temCache } = await carregarBaseParcelas(supabase);

  // Carteira por cliente — só quem ainda tem algo a receber (a vencer ou vencido).
  const porContato = new Map<number, ParcelaCarteira[]>();
  for (const p of parcelas) porContato.set(p.contatoId, [...(porContato.get(p.contatoId) ?? []), p]);
  const carteira: ClienteCarteira[] = [];
  for (const [contatoId, lista] of porContato) {
    const abertas = lista.filter((p) => p.situacao === "em_aberto" || p.situacao === "atrasada");
    if (abertas.length === 0) continue;
    const local = clientePorContato.get(contatoId);
    carteira.push({
      contatoId,
      clienteId: local?.id ?? null,
      nome: nomeDoContato(contatoId),
      logoPath: local?.logo_path ?? null,
      valorTotal: lista.reduce((s, p) => s + p.valor, 0),
      pagas: lista.filter((p) => p.situacao === "recebida").length,
      total: lista.length,
      proximoVencimento: lista.find((p) => p.situacao === "em_aberto")?.vencimento ?? null,
      atrasado: lista.some((p) => p.situacao === "atrasada"),
    });
  }
  carteira.sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || b.valorTotal - a.valorTotal);

  // KPIs do mês corrente (por data de VENCIMENTO — o cache não tem a data da baixa).
  const hoje = hojeLocal();
  const mes = hoje.slice(0, 7);
  const doMes = parcelas.filter((p) => p.vencimento.startsWith(mes));
  const soma = (lista: ParcelaCarteira[]) => lista.reduce((s, p) => s + p.valor, 0);
  const vencidas = parcelas.filter((p) => p.situacao === "atrasada");
  const aVencer = parcelas.filter((p) => p.situacao === "em_aberto");

  const resumo: ResumoFinanceiro = {
    carteiraAtiva: soma(aVencer),
    clientesAtivos: new Set(aVencer.map((p) => p.contatoId)).size,
    previstoMes: soma(doMes),
    aReceberMes: soma(doMes.filter((p) => p.situacao === "em_aberto" || p.situacao === "atrasada")),
    recebidoMes: soma(doMes.filter((p) => p.situacao === "recebida")),
    vencido: soma(vencidas),
    clientesComVencido: new Set(vencidas.map((p) => p.contatoId)).size,
  };

  const parcelasDoMes = doMes
    .map((p) => ({ ...p, cliente: nomeDoContato(p.contatoId), clienteId: clientePorContato.get(p.contatoId)?.id ?? null }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return { resumo, carteira, parcelasDoMes, sincronizadoEm, temCache };
}

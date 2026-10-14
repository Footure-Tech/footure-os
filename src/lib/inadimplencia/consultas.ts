import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buscarParcelasAtrasadasDoContato, type ParcelaAtrasadaDetalhe } from "@/lib/integracoes/bling";

type Supa = SupabaseClient<Database>;

export interface ClienteInadimplente {
  blingContatoId: number;
  clienteId: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  logoPath: string | null;
  parcelas: ParcelaAtrasadaDetalhe[];
  totalAtrasado: number;
}

/**
 * Parte do cache (bling_contatos.tem_parcela_atrasada, populado na
 * sincronização) pra saber QUEM está inadimplente sem precisar varrer todo
 * mundo — só os poucos clientes já sinalizados têm o detalhe de parcelas
 * buscado ao vivo (conjunto pequeno o bastante pra não estourar o limite de
 * 3 req/s do Bling, ao contrário da lista de clientes inteira).
 */
export async function listarClientesInadimplentes(supabase: Supa): Promise<ClienteInadimplente[]> {
  const [{ data: contatosAtrasados, error: erroContatos }, { data: clientesLocais, error: erroClientes }] = await Promise.all([
    supabase.from("bling_contatos").select("id, nome").eq("tem_parcela_atrasada", true),
    supabase.from("clientes").select("id, razao_social, nome_fantasia, logo_path, bling_contato_id").not("bling_contato_id", "is", null),
  ]);
  if (erroContatos) console.error("[inadimplencia/consultas] contatosAtrasados:", erroContatos.message);
  if (erroClientes) console.error("[inadimplencia/consultas] clientesLocais:", erroClientes.message);

  const clientesPorBlingId = new Map((clientesLocais ?? []).map((c) => [c.bling_contato_id!, c]));

  const resultado: ClienteInadimplente[] = [];
  for (const contato of contatosAtrasados ?? []) {
    const parcelas = await buscarParcelasAtrasadasDoContato(supabase, contato.id);
    if (parcelas.length === 0) continue; // cache pode estar levemente desatualizado desde a última sincronização
    const clienteLocal = clientesPorBlingId.get(contato.id) ?? null;
    resultado.push({
      blingContatoId: contato.id,
      clienteId: clienteLocal?.id ?? null,
      razaoSocial: clienteLocal?.razao_social ?? contato.nome,
      nomeFantasia: clienteLocal?.nome_fantasia ?? null,
      logoPath: clienteLocal?.logo_path ?? null,
      parcelas,
      totalAtrasado: parcelas.reduce((soma, p) => soma + p.valor, 0),
    });
  }
  return resultado.sort((a, b) => b.totalAtrasado - a.totalAtrasado);
}

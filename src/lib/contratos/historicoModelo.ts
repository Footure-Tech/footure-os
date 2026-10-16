// Histórico do modelo de contrato (Jurídico · Histórico do modelo): cada
// alteração no modelo — trecho agregado pelo jurídico (0041) ou ajuste
// desativado — é um evento e gera uma nova versão do modelo daquele perfil
// (v1 = texto padrão do sistema).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

export interface EventoModelo {
  chave: string;
  versao: number;
  perfil: "clube" | "agente";
  tipo: "agregado" | "desativado";
  data: string;
  usuario: string | null;
  ajusteId: string;
  ativo: boolean;
  trechoOriginal: string;
  trechoNovo: string;
  clausula: string | null;
  resumo: string | null;
  motivo: string | null;
  origem: { pedidoId: string; cliente: string; versaoContrato: number } | null;
  /** Para o evento de agregação: quando/quem desativou depois (se desativou). */
  desativadoEm: string | null;
  desativadoPor: string | null;
}

export async function carregarHistoricoModelo(supabase: Supa): Promise<{ eventos: EventoModelo[]; erro: string | null }> {
  const { data, error } = await supabase
    .from("modelo_contrato_ajustes")
    .select(
      "id, perfil, trecho_original, trecho_novo, ativo, criado_em, desativado_em, criador:profiles!modelo_contrato_ajustes_criado_por_fkey(nome), desativador:profiles!modelo_contrato_ajustes_desativado_por_fkey(nome), contrato_mudancas(clausula, resumo, motivo_sugestao, contrato_analises(contratos!contrato_analises_contrato_id_fkey(versao, pedidos(id, clientes(razao_social, nome_fantasia)))))",
    )
    .order("criado_em");
  if (error) return { eventos: [], erro: error.message };

  const nome = (x: unknown) => (x as { nome: string } | null)?.nome ?? null;
  const base = (data ?? []).flatMap((a) => {
    const mudanca = a.contrato_mudancas as unknown as {
      clausula: string | null;
      resumo: string | null;
      motivo_sugestao: string | null;
      contrato_analises: { contratos: { versao: number; pedidos: { id: string; clientes: { razao_social: string; nome_fantasia: string | null } | null } | null } | null } | null;
    } | null;
    const contrato = mudanca?.contrato_analises?.contratos;
    const cliente = contrato?.pedidos?.clientes;
    const comum = {
      perfil: a.perfil,
      ajusteId: a.id,
      ativo: a.ativo,
      trechoOriginal: a.trecho_original,
      trechoNovo: a.trecho_novo,
      clausula: mudanca?.clausula ?? null,
      resumo: mudanca?.resumo ?? null,
      motivo: mudanca?.motivo_sugestao ?? null,
      origem: contrato?.pedidos ? { pedidoId: contrato.pedidos.id, cliente: cliente?.nome_fantasia || cliente?.razao_social || "Cliente", versaoContrato: contrato.versao } : null,
      desativadoEm: a.desativado_em,
      desativadoPor: nome(a.desativador),
    };
    const eventos: Omit<EventoModelo, "versao">[] = [{ ...comum, chave: `${a.id}:agregado`, tipo: "agregado", data: a.criado_em, usuario: nome(a.criador) }];
    if (a.desativado_em) eventos.push({ ...comum, chave: `${a.id}:desativado`, tipo: "desativado", data: a.desativado_em, usuario: nome(a.desativador) });
    return eventos;
  });

  // Versão por perfil, na ordem cronológica (v1 = modelo padrão; cada evento gera a seguinte).
  const contador = { clube: 1, agente: 1 };
  const eventos = base
    .sort((x, y) => x.data.localeCompare(y.data))
    .map((e) => ({ ...e, versao: ++contador[e.perfil] }))
    .reverse();
  return { eventos, erro: null };
}

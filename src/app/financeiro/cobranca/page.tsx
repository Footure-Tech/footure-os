import { exigirPapel } from "@/lib/auth/session";
import { PAPEIS_COBRANCA } from "@/lib/cobranca/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarTelaCobranca, type AbaCobranca } from "@/lib/cobranca/consultas";
import { TelaCobranca } from "@/components/cobranca/tela-cobranca";

const ABAS: AbaCobranca[] = ["aprovacao", "historico", "clientes", "configuracao"];

// Aprovar envia os e-mails e confere cada parcela no Bling — pode levar mais que o padrão.
export const maxDuration = 300;

// Financeiro · Régua de cobrança (0058). Diretoria e Financeiro (o layout do Financeiro também libera o comercial).
export default async function CobrancaPage({ searchParams }: PageProps<"/financeiro/cobranca">) {
  await exigirPapel(...PAPEIS_COBRANCA);
  const { aba: a } = await searchParams;
  const aba = ABAS.includes(a as AbaCobranca) ? (a as AbaCobranca) : "aprovacao";
  const dados = await carregarTelaCobranca(await createClient());
  return <TelaCobranca dados={dados} aba={aba} />;
}

import { createClient } from "@/lib/supabase/server";
import { carregarPagamentos, hojeLocal, type StatusPagamento } from "@/lib/financeiro/carteira";
import { TelaPagamentos } from "@/components/financeiro/tela-pagamentos";

const STATUS: StatusPagamento[] = ["em_aberto", "atrasada", "paga"];

// Financeiro · Pagamentos — parcelas do mês (?mes=aaaa-mm, padrão = mês corrente).
export default async function PagamentosPage({ searchParams }: PageProps<"/financeiro/pagamentos">) {
  const { mes: m, status: s } = await searchParams;
  const mesAtual = hojeLocal().slice(0, 7);
  const mes = typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : mesAtual;
  const status = typeof s === "string" ? s.split(",").filter((x): x is StatusPagamento => STATUS.includes(x as StatusPagamento)) : [];
  const supabase = await createClient();
  const dados = await carregarPagamentos(supabase, mes);
  return <TelaPagamentos dados={dados} mes={mes} mesAtual={mesAtual} status={status} />;
}

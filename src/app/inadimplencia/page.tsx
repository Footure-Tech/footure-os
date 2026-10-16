import { createClient } from "@/lib/supabase/server";
import { carregarInadimplencia, type FiltroContratosInadimplencia } from "@/lib/inadimplencia/consultas";
import { carregarBaseParcelas } from "@/lib/financeiro/carteira";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaInadimplencia } from "@/components/inadimplencia/tela-inadimplencia";

// Lê só o cache do Bling (bling_parcelas, gravado em "Sincronizar").
// Padrão: só contratos ativos (vigência em curso); ?contratos=todos mostra a carteira inteira.
export default async function InadimplenciaPage({ searchParams }: PageProps<"/inadimplencia">) {
  const { contratos } = await searchParams;
  const filtro: FiltroContratosInadimplencia = contratos === "todos" ? "todos" : "ativos";
  const supabase = await createClient();
  const base = await carregarBaseParcelas(supabase);
  const [dados, todos, ativos] = await Promise.all([
    carregarInadimplencia(supabase, base, filtro),
    carregarInadimplencia(supabase, base, "todos"),
    carregarInadimplencia(supabase, base, "ativos"),
  ]);
  return (
    <TelaInadimplencia
      dados={dados}
      filtro={filtro}
      contagens={{ todos: todos.clientes.length, ativos: ativos.clientes.length }}
      urlLogo={(path) => urlLogoCliente(supabase, path)}
    />
  );
}

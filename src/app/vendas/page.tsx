import { createClient } from "@/lib/supabase/server";
import { carregarVendas, type PeriodoVendas } from "@/lib/vendas/consultas";
import { carregarVendasAcademy } from "@/lib/academy/vendas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { lerContextoDados } from "@/lib/contexto/contexto";
import { TelaVendas } from "@/components/vendas/tela-vendas";
import { TelaVendasAcademy } from "@/components/vendas/tela-vendas-academy";

const PERIODOS: PeriodoVendas[] = ["mes", "tri", "12m"];

// Comercial · Vendas — pedidos de venda do Bling (cache da sincronização), mais
// recentes primeiro: do Footlink ou, no contexto Academy, da loja do Academy.
export default async function VendasPage({ searchParams }: PageProps<"/vendas">) {
  const { periodo: p } = await searchParams;
  const periodo = PERIODOS.includes(p as PeriodoVendas) ? (p as PeriodoVendas) : "mes";
  const supabase = await createClient();

  if ((await lerContextoDados()) === "academy") {
    const { doPeriodo, sincronizadoEm, temCache } = await carregarVendasAcademy(supabase);
    return (
      <TelaVendasAcademy
        vendas={doPeriodo(periodo)}
        periodo={periodo}
        contagens={{ mes: doPeriodo("mes").length, tri: doPeriodo("tri").length, "12m": doPeriodo("12m").length }}
        sincronizadoEm={sincronizadoEm}
        temCache={temCache}
      />
    );
  }

  const { doPeriodo, sincronizadoEm, temCache } = await carregarVendas(supabase);
  return (
    <TelaVendas
      vendas={doPeriodo(periodo)}
      periodo={periodo}
      contagens={{ mes: doPeriodo("mes").length, tri: doPeriodo("tri").length, "12m": doPeriodo("12m").length }}
      sincronizadoEm={sincronizadoEm}
      temCache={temCache}
      urlLogo={(path) => urlLogoCliente(supabase, path)}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { carregarInadimplencia } from "@/lib/inadimplencia/consultas";
import { urlLogoCliente } from "@/lib/clientes/consultas";
import { TelaInadimplencia } from "@/components/inadimplencia/tela-inadimplencia";

// Lê só o cache do Bling (bling_parcelas, gravado em "Sincronizar").
export default async function InadimplenciaPage() {
  const supabase = await createClient();
  const dados = await carregarInadimplencia(supabase);
  return <TelaInadimplencia dados={dados} urlLogo={(path) => urlLogoCliente(supabase, path)} />;
}

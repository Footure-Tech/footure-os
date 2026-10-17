// Contexto dos dados (seletor da AppBar): Footlink (licenças de software, o
// padrão) ou Footure Academy (cursos). Fica num cookie; as telas que já
// têm versão do Academy leem daqui, as outras continuam com os dados do Footlink.
import { cookies } from "next/headers";

export const CONTEXTOS = ["footlink", "academy"] as const;
export type ContextoDados = (typeof CONTEXTOS)[number];
export const COOKIE_CONTEXTO = "contexto_dados";

export async function lerContextoDados(): Promise<ContextoDados> {
  const valor = (await cookies()).get(COOKIE_CONTEXTO)?.value;
  return CONTEXTOS.includes(valor as ContextoDados) ? (valor as ContextoDados) : "footlink";
}

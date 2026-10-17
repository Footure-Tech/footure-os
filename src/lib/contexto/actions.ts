"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_CONTEXTO, CONTEXTOS, type ContextoDados } from "./contexto";

/** Troca o contexto dos dados; a tela atual é refeita com o novo contexto. */
export async function definirContextoDadosAction(contexto: ContextoDados): Promise<void> {
  if (!CONTEXTOS.includes(contexto)) return;
  (await cookies()).set(COOKIE_CONTEXTO, contexto, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

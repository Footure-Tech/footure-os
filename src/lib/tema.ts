// Tema claro/escuro do Footlink DS: atributo data-theme no <html>, persistido
// em localStorage "footlink_theme" (mesma chave do produto Footlink). Módulo
// neutro (sem "use client") porque o script abaixo é injetado pelo root
// layout (Server Component) e as constantes são usadas pelo hook no client.

export type Tema = "light" | "dark";

export const CHAVE_TEMA = "footlink_theme";

/** Roda antes da hidratação (next/script beforeInteractive) — aplica o tema
 * salvo antes da primeira pintura, sem flash do tema claro. Em try/catch
 * porque localStorage lança em modo privado/bloqueado; aí fica no claro. */
export const SCRIPT_TEMA_INICIAL = `try{var t=localStorage.getItem("${CHAVE_TEMA}");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

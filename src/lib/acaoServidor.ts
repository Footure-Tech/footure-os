// Server Actions que devolvem o erro como DADO. Em produção o Next esconde a
// mensagem de erros LANÇADOS por Server Actions — a tela via só um código
// genérico do React ("Minified React error #441"). Aqui o erro vira
// { erro: "mensagem" }; o cliente usa exigirSucesso (lib/resultadoAcao.ts).
// Redirecionamentos e notFound do Next passam adiante (unstable_rethrow).
import { unstable_rethrow } from "next/navigation";

export interface ResultadoAcao {
  erro?: string;
}

export async function executar(fn: () => Promise<unknown>): Promise<ResultadoAcao> {
  try {
    await fn();
    return {};
  } catch (erro) {
    unstable_rethrow(erro);
    return { erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

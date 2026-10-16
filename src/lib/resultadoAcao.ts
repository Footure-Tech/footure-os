// Lado do cliente das Server Actions que devolvem { erro } (ver
// lib/pedidos/serverActions.ts → executar): lança no navegador, onde a
// mensagem não é escondida, para os try/catch das telas mostrarem o motivo real.
export function exigirSucesso<T extends { erro?: string } | void>(resultado: T): T {
  const erro = resultado && typeof resultado === "object" && "erro" in resultado ? resultado.erro : undefined;
  if (erro) throw new Error(erro);
  return resultado;
}

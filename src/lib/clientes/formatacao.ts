/** Dados antigos às vezes já vêm só com dígitos, às vezes já pontuados (ou
 * incompletos) — reformata a partir dos dígitos e devolve o valor original
 * sem alteração quando não dá pra montar um CNPJ válido de 14 dígitos. */
export function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return cnpj;
  return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export interface EnderecoEstruturado {
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  endereco_legado?: string | null;
}

/**
 * Compõe o endereço estruturado (padrão Bling — endereco.geral) numa string
 * só, usada no texto do contrato e na exibição. Clientes cadastrados antes da
 * migração 0023 (endereço estruturado) ainda não preencheram esses campos —
 * cai para o texto livre antigo (endereco_legado) até alguém reeditar.
 */
export function formatarEnderecoCliente(c: EnderecoEstruturado): string {
  if (!c.endereco) return c.endereco_legado ?? "";
  const linha1 = `${c.endereco}, ${c.numero ?? "S/N"}${c.complemento ? ` - ${c.complemento}` : ""}`;
  const linha2 = [c.bairro, c.municipio && c.uf ? `${c.municipio}/${c.uf}` : c.municipio].filter(Boolean).join(", ");
  const cep = c.cep ? `CEP ${c.cep}` : "";
  return [linha1, linha2, cep].filter(Boolean).join(", ");
}

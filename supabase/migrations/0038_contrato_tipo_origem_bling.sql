-- Footure OS
-- 0038_contrato_tipo_origem_bling.sql: tipo de venda (novo contrato,
-- renovação ou reativação) e origem (carteira, inbound ou outbound) das vendas
-- que são pedidos de venda do Bling. Dados comerciais, como SDR e Closer — por
-- isso ficam na mesma tabela de 0035 (uma linha por pedido de venda do Bling).
-- Ambos opcionais (null = não informado); informados na tela "Editar dados do
-- contrato".

alter table contrato_equipe_bling
  add column tipo_venda text check (tipo_venda in ('novo', 'renovacao', 'reativacao')),
  add column origem text check (origem in ('carteira', 'inbound', 'outbound'));

-- Footure OS
-- 0039_pedidos_tipo_origem.sql: tipo de venda (novo contrato, renovação,
-- reativação) e origem (carteira, inbound, outbound) também nos pedidos de
-- venda criados na plataforma — os mesmos campos de 0038 para as vendas que
-- vêm do Bling. Opcionais (null = não informado).

alter table pedidos
  add column tipo_venda text check (tipo_venda in ('novo', 'renovacao', 'reativacao')),
  add column origem text check (origem in ('carteira', 'inbound', 'outbound'));

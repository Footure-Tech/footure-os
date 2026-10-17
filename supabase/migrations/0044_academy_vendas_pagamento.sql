-- Footure OS
-- 0044_academy_vendas_pagamento.sql: dados de pagamento e baixa das vendas do
-- Academy, para o relatório de vendas por curso.
--
-- Do detalhe do pedido de venda (/pedidos/vendas/{id}):
--   total_produtos, desconto, cupom (de "Cupom: X - Desconto: …" nas
--   observações), numero_loja (id do pedido no e-commerce) e pagamentos — uma
--   entrada por parcela do pedido: forma de pagamento (/formas-pagamentos/{id}),
--   meio (cartao/pix/boleto/outro), nº de parcelas do cartão (da descrição,
--   ex.: "Pagar.me 12x"), valor e a taxa cadastrada na forma (alíquota % e valor fixo).
--   detalhado_em: quando esses dados foram lidos (null = ler na próxima sincronização).
--
-- Da baixa (contas a receber do pedido → borderôs): taxa_real (tarifa) e
-- valor_recebido (valor pago), gravados quando todas as contas do pedido estão
-- recebidas; baixa_em = data da última baixa. Sem isso, o relatório estima a
-- taxa pela forma de pagamento.

alter table academy_vendas
  add column total_produtos       numeric(12, 2),
  add column desconto             numeric(12, 2),
  add column cupom                text,
  add column numero_loja          text,
  add column pagamentos           jsonb,
  add column detalhado_em         timestamptz,
  add column taxa_real            numeric(12, 2),
  add column valor_recebido       numeric(12, 2),
  add column baixa_em             date,
  add column baixa_consultada_em  timestamptz;

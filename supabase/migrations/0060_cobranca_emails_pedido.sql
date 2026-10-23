-- Régua de cobrança: destinatários pelo pedido de venda.
--
-- O financeiro anota no pedido de venda do Bling, em "Observações internas",
-- os e-mails de quem recebe a nota e a cobrança ("E-mail financeiro: …" — o
-- próprio sistema e o Pluga escrevem assim). Esses e-mails passam a ter
-- prioridade: com e-mail nas observações do pedido, só eles recebem (mais os
-- destinatários extras da régua); sem, vale o cadastro do contato no Bling.
--
-- • cobranca_envio_itens.bling_pedido_id: o pedido de cada parcela.
-- • cobranca_pedidos_emails: cache dos e-mails extraídos das observações
--   internas de cada pedido (relidos a cada 7 dias, como os do contato).

alter table cobranca_envio_itens add column bling_pedido_id bigint;

create table cobranca_pedidos_emails (
  bling_pedido_id  bigint primary key,
  emails           text[] not null default '{}',
  buscados_em      timestamptz not null default now()
);

alter table cobranca_pedidos_emails enable row level security;
create policy cobranca_pedidos_emails_operacao on cobranca_pedidos_emails
  for all using (public.meu_papel()::text in ('admin', 'financeiro'))
  with check (public.meu_papel()::text in ('admin', 'financeiro'));

-- Footlink — Sistema de Fechamento de Venda
-- 0031_bling_pedidos.sql: cache dos pedidos de venda do Bling — o "contrato"
-- da tela Financeiro · Contratos (data de início, valor total e situação,
-- incl. cancelado). A sincronização já chamava /pedidos/vendas de cada
-- contato só para CONTAR os pedidos; agora guarda o que já vinha na resposta,
-- sem nenhuma chamada extra ao Bling. As parcelas (bling_parcelas) se ligam ao
-- pedido por (contato_id, numero_pedido_origem = numero).

create table bling_pedidos (
  id               bigint primary key, -- id do pedido de venda no Bling
  contato_id       bigint not null references bling_contatos (id) on delete cascade,
  numero           text not null,
  data             date,
  total            numeric(12, 2) not null default 0,
  situacao_id      integer,             -- situação do pedido (configurável no Bling)
  situacao_valor   integer,             -- código interno da situação (padrão do Bling)
  sincronizado_em  timestamptz not null default now()
);

create index bling_pedidos_contato_numero_idx on bling_pedidos (contato_id, numero);
create index bling_pedidos_data_idx on bling_pedidos (data);

alter table bling_pedidos enable row level security;

-- Mesmo padrão de bling_contatos/bling_parcelas.
create policy bling_pedidos_select on bling_pedidos
  for select
  using (auth.uid() is not null);

create policy bling_pedidos_write on bling_pedidos
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

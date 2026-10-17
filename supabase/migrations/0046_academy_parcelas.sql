-- Footure OS
-- 0046_academy_parcelas.sql: contas a receber das vendas do Academy (parcelas
-- dos pedidos em academy_vendas), para Inadimplência, Clientes e Dashboard no
-- contexto Academy. Gravado na sincronização: a listagem de contas a receber
-- da conta inteira por data de emissão (janelas de 366 dias) já traz situação,
-- vencimento e valor; ficam só as dos pedidos do Academy. Sem FK para
-- academy_vendas pelo mesmo motivo dos outros caches (a sincronização apaga o
-- que some do Bling). situacao: códigos do Bling (1 em aberto, 2 recebida,
-- 3 parcialmente recebida, 5 cancelada) — ver classificarSituacaoParcela.

create table academy_parcelas (
  id               bigint primary key,
  bling_pedido_id  bigint not null,
  contato_id       bigint,
  vencimento       date not null,
  valor            numeric(12, 2) not null default 0,
  situacao         integer not null,
  sincronizado_em  timestamptz not null default now()
);

create index academy_parcelas_pedido_idx on academy_parcelas (bling_pedido_id);
create index academy_parcelas_contato_idx on academy_parcelas (contato_id);

alter table academy_parcelas enable row level security;

create policy academy_parcelas_select on academy_parcelas for select using (auth.uid() is not null);
create policy academy_parcelas_write on academy_parcelas for all using (auth.uid() is not null) with check (auth.uid() is not null);

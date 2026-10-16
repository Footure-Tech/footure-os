-- Footure OS
-- 0035_contrato_equipe_bling.sql: SDR e Closer das vendas que são pedidos de
-- venda do Bling. O Bling não tem esse dado (só pedidos fechados pela
-- plataforma têm pedidos.sdr_id/closer_id) — a Diretoria informa na tela
-- Financeiro · Contrato, como a vigência (0034).
--
-- Uma linha por pedido de venda do Bling; sem FK para bling_pedidos pelo mesmo
-- motivo de 0033/0034 (a sincronização apaga pedidos que somem do Bling).

create table contrato_equipe_bling (
  bling_pedido_id  bigint primary key,
  sdr_id           uuid references profiles (user_id),
  closer_id        uuid references profiles (user_id),
  atualizado_por   uuid references profiles (user_id),
  atualizado_em    timestamptz not null default now()
);

alter table contrato_equipe_bling enable row level security;

create policy contrato_equipe_bling_select on contrato_equipe_bling
  for select
  using (auth.uid() is not null);

create policy contrato_equipe_bling_insert on contrato_equipe_bling
  for insert
  with check (public.meu_papel() = 'admin');

create policy contrato_equipe_bling_update on contrato_equipe_bling
  for update
  using (public.meu_papel() = 'admin')
  with check (public.meu_papel() = 'admin');

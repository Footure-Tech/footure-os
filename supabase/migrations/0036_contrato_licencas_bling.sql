-- Footure OS
-- 0036_contrato_licencas_bling.sql: licenças das vendas que são pedidos de
-- venda do Bling — nº de licenças pagas, nº de gratuitas e valor da licença
-- adicional. Existem no pedido da plataforma (pedidos.licencas_pagas etc.),
-- mas não no Bling; a Diretoria informa na tela Financeiro · Contrato, como a
-- vigência (0034) e SDR/Closer (0035).
--
-- Uma linha por pedido de venda do Bling; sem FK para bling_pedidos pelo mesmo
-- motivo de 0033–0035 (a sincronização apaga pedidos que somem do Bling).

create table contrato_licencas_bling (
  bling_pedido_id          bigint primary key,
  licencas_pagas           integer not null check (licencas_pagas >= 0),
  licencas_gratuitas       integer not null default 0 check (licencas_gratuitas >= 0),
  valor_licenca_adicional  numeric(12, 2) check (valor_licenca_adicional >= 0),
  atualizado_por           uuid references profiles (user_id),
  atualizado_em            timestamptz not null default now()
);

alter table contrato_licencas_bling enable row level security;

create policy contrato_licencas_bling_select on contrato_licencas_bling
  for select
  using (auth.uid() is not null);

create policy contrato_licencas_bling_insert on contrato_licencas_bling
  for insert
  with check (public.meu_papel() = 'admin');

create policy contrato_licencas_bling_update on contrato_licencas_bling
  for update
  using (public.meu_papel() = 'admin')
  with check (public.meu_papel() = 'admin');

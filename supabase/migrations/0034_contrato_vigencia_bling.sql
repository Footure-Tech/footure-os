-- Footure OS
-- 0034_contrato_vigencia_bling.sql: vigência (início e fim) dos contratos que
-- são pedidos de venda do Bling. O Bling não tem esse dado — sem ele, um
-- cliente que pagou à vista (todas as parcelas recebidas) aparecia como
-- inativo com o contrato em vigor. O controle da vigência passa a ser da
-- plataforma: a Diretoria informa na tela Financeiro · Contrato.
--
-- Uma linha por pedido de venda do Bling. Sem FK para bling_pedidos pelo mesmo
-- motivo de 0033: a sincronização apaga do cache pedidos que somem do Bling.

create table contrato_vigencia_bling (
  bling_pedido_id  bigint primary key,
  vigencia_inicio  date not null,
  vigencia_fim     date not null,
  atualizado_por   uuid references profiles (user_id),
  atualizado_em    timestamptz not null default now(),
  check (vigencia_fim >= vigencia_inicio)
);

create index contrato_vigencia_bling_fim_idx on contrato_vigencia_bling (vigencia_fim);

alter table contrato_vigencia_bling enable row level security;

-- Leitura para qualquer usuário autenticado: a situação do cliente (lista e
-- detalhe de Clientes, que o comercial também vê) depende da vigência.
create policy contrato_vigencia_bling_select on contrato_vigencia_bling
  for select
  using (auth.uid() is not null);

-- Edição só pela Diretoria (Financeiro).
create policy contrato_vigencia_bling_insert on contrato_vigencia_bling
  for insert
  with check (public.meu_papel() = 'admin');

create policy contrato_vigencia_bling_update on contrato_vigencia_bling
  for update
  using (public.meu_papel() = 'admin')
  with check (public.meu_papel() = 'admin');

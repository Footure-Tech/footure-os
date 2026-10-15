-- Footlink — Sistema de Fechamento de Venda
-- 0030_bling_parcelas.sql: cache das parcelas (contas a receber) do Bling,
-- gravado na mesma sincronização que já alimenta bling_contatos — a
-- sincronização já busca /contas/receber de cada contato; antes só guardava
-- contagens. Com as parcelas em cache, a tela Financeiro (carteira, KPIs,
-- parcelas do mês) não depende de chamar o Bling ao vivo (limite de 3 req/s).
-- Ainda não há vínculo pedido -> Bling: a carteira é por cliente (contato).

create table bling_parcelas (
  id                    bigint primary key, -- id da conta a receber no Bling
  contato_id            bigint not null references bling_contatos (id) on delete cascade,
  numero_pedido_origem  text,
  vencimento            date not null,
  valor                 numeric(12, 2) not null,
  situacao              integer not null, -- código do Bling (ver classificarSituacaoParcela)
  sincronizado_em       timestamptz not null default now()
);

create index bling_parcelas_contato_id_idx on bling_parcelas (contato_id);
create index bling_parcelas_vencimento_idx on bling_parcelas (vencimento);

alter table bling_parcelas enable row level security;

-- Mesmo padrão de bling_contatos: leitura e escrita para qualquer usuário
-- autenticado (a sincronização roda com a sessão de quem clicou).
create policy bling_parcelas_select on bling_parcelas
  for select
  using (auth.uid() is not null);

create policy bling_parcelas_write on bling_parcelas
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Footure OS
-- 0042_academy_vendas.sql: cache das vendas do Footure Academy — pedidos de
-- venda da loja do Academy no Bling (e-commerce, loja 203655786). Os
-- compradores são pessoa física, por isso não entram em bling_contatos /
-- bling_pedidos (que são só dos clientes PJ do Footlink). Gravado na mesma
-- sincronização do Bling; o item (curso) vem do detalhe do pedido, buscado só
-- para pedidos novos.
--
-- categoria (classificação pelo nome do produto, decisão de produto out/2026):
--   especializacao = "Especialização …" e "Certificação Executivo de Futebol";
--   livre          = demais cursos (SAF 2.0, Python para Futebol, Combo…);
--   assinatura     = Silver/Gold e Footure Insights;
--   mensalidade    = cobrança recorrente de curso já vendido ("Assinatura - <curso> (Nome)").
-- Vendas = especializacao + livre, fora os cancelados.

create table academy_vendas (
  bling_pedido_id    bigint primary key,
  numero             text not null,
  data               date,
  total              numeric(12, 2) not null default 0,
  situacao_id        integer,
  situacao_valor     integer,
  contato_id         bigint,
  contato_nome       text,
  contato_documento  text,
  produto            text,
  categoria          text not null check (categoria in ('especializacao', 'livre', 'assinatura', 'mensalidade')),
  sincronizado_em    timestamptz not null default now()
);

create index academy_vendas_data_idx on academy_vendas (data);

alter table academy_vendas enable row level security;

-- Mesmo padrão dos caches do Bling (a sincronização roda com a sessão de quem clicou).
create policy academy_vendas_select on academy_vendas for select using (auth.uid() is not null);
create policy academy_vendas_write on academy_vendas for all using (auth.uid() is not null) with check (auth.uid() is not null);

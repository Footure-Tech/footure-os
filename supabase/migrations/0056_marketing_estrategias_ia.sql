-- Footure OS
-- 0056_marketing_estrategias_ia.sql: "Estratégias por IA" da aba Funil (F4)
-- na mesma tabela das "Sugestões por IA" de criativos (0049) — mesmo
-- histórico de rodadas, tokens e custo (o consumo mostrado na tela soma as duas).
--
-- tipo: 'criativos' (0049, aba Criativos) ou 'funil' (aba Funil: objeções,
-- abordagem, ajustes de campanha e perguntas de qualificação).
-- periodo passa a aceitar 'tudo' (a aba Funil tem "Campanha inteira").
--
-- Idempotente: pode rodar de novo.

alter table mkt_sugestoes_ia
  add column if not exists tipo text not null default 'criativos' check (tipo in ('criativos', 'funil'));

alter table mkt_sugestoes_ia drop constraint if exists mkt_sugestoes_ia_periodo_check;
alter table mkt_sugestoes_ia add constraint mkt_sugestoes_ia_periodo_check check (periodo in ('30d', '90d', 'tudo'));

create index if not exists mkt_sugestoes_ia_tipo_idx on mkt_sugestoes_ia (campanha_chave, tipo, criado_em desc);

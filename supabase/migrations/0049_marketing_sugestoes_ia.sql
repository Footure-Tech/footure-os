-- Footure OS
-- 0049_marketing_sugestoes_ia.sql: rodadas de "Sugestões por IA" de uma
-- campanha (detalhe da campanha no Marketing). Cada clique em "Gerar novas
-- sugestões" chama a API da Anthropic uma vez e grava aqui o resultado, os
-- números enviados (auditoria), os tokens e o custo calculado — é a base do
-- consumo mostrado na tela. Só a Diretoria lê e gera.

create table mkt_sugestoes_ia (
  id               uuid primary key default gen_random_uuid(),
  campanha_chave   text not null,          -- "conta:campanha"
  campanha_nome    text not null,
  periodo          text not null check (periodo in ('30d', '90d')),
  periodo_de       date not null,
  periodo_ate      date not null,
  modelo           text not null,
  tokens_entrada   integer not null default 0,
  tokens_saida     integer not null default 0,
  custo_usd        numeric(10, 4) not null default 0,
  entrada          jsonb not null,         -- números e criativos enviados à IA
  resultado        jsonb not null,         -- diagnóstico, criativos, conceitos, testes, alertas
  criado_por       uuid references profiles (user_id),
  criado_em        timestamptz not null default now()
);

create index mkt_sugestoes_ia_campanha_idx on mkt_sugestoes_ia (campanha_chave, criado_em desc);

alter table mkt_sugestoes_ia enable row level security;
create policy mkt_sugestoes_ia_admin on mkt_sugestoes_ia
  for all using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

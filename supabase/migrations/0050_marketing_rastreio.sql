-- Footure OS
-- 0050_marketing_rastreio.sql: verificação do rastreio (tagueamento) das
-- campanhas no Marketing.
--
-- 1. Em mkt_meta_criativos, lidos da Meta na sincronização: páginas de destino
--    do anúncio (sem a query string), os "Parâmetros de URL" (url_tags) e o
--    status do anúncio — base da verificação automática por anúncio.
-- 2. mkt_verificacoes_rastreio: verificação de ponta a ponta feita pela
--    Diretoria — o sistema gera um link de teste com um código, a pessoa
--    preenche o formulário da página com esse código e o sistema confere, no
--    lead que chegou ao Kommo, campo a campo. O status final fica gravado; uma
--    nova verificação cria outra linha (a mais recente é o status atual).

-- "if not exists": a coluna urls_destino pode já existir (versão anterior deste arquivo).
alter table mkt_meta_criativos
  add column if not exists urls_destino   text[],
  add column if not exists url_tags       text,
  add column if not exists status_anuncio text;     -- effective_status da Meta (ACTIVE, PAUSED…)

create table if not exists mkt_verificacoes_rastreio (
  id              uuid primary key default gen_random_uuid(),
  campanha_chave  text not null,          -- "conta:campanha"
  codigo          text not null unique,   -- vai no nome/e-mail do lead de teste
  url_teste       text not null,
  esperado        jsonb not null,         -- valores esperados por campo
  status          text not null default 'aguardando' check (status in ('aguardando', 'ok', 'problema')),
  resultado       jsonb,                  -- campo a campo: esperado × recebido
  lead_id         bigint,
  criado_por      uuid references profiles (user_id),
  criado_em       timestamptz not null default now(),
  verificado_em   timestamptz
);

create index if not exists mkt_verificacoes_rastreio_campanha_idx on mkt_verificacoes_rastreio (campanha_chave, criado_em desc);

alter table mkt_verificacoes_rastreio enable row level security;
drop policy if exists mkt_verificacoes_rastreio_admin on mkt_verificacoes_rastreio;
create policy mkt_verificacoes_rastreio_admin on mkt_verificacoes_rastreio
  for all using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

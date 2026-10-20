-- Histórico e trava da sincronização com o Bling (contatos, parcelas, baixas e
-- vendas do Academy). Até aqui ela só rodava pelo botão da sidebar e só deixava
-- rastro em bling_contatos.sincronizado_em; com o cron (/api/cron/bling, 7h, 12h
-- e 18h BRT) passa a registrar cada execução, inclusive as que falham.
--
-- Trava: no máximo uma execução 'rodando' (índice único parcial). Duas
-- execuções simultâneas renovariam o token OAuth ao mesmo tempo — o Bling
-- invalida o refresh_token anterior a cada renovação, então uma delas perderia
-- a conexão. Execução interrompida (função da Vercel morta no limite) fica
-- 'rodando' para sempre; o código a encerra como 'erro' antes de tentar a
-- próxima (ver iniciarExecucao em src/lib/integracoes/blingSincronizacao.ts).

create table bling_sync_execucoes (
  id            uuid primary key default gen_random_uuid(),
  origem        text not null check (origem in ('cron', 'manual')),
  status        text not null default 'rodando' check (status in ('rodando', 'ok', 'erro')),
  resumo        jsonb,
  erro          text,
  iniciado_em   timestamptz not null default now(),
  terminado_em  timestamptz,
  disparado_por uuid references profiles (user_id)   -- null = cron
);

create index bling_sync_execucoes_iniciado_idx on bling_sync_execucoes (iniciado_em desc);
create unique index bling_sync_execucoes_uma_rodando on bling_sync_execucoes ((true)) where status = 'rodando';

-- RLS: leitura para quem vê o card de Integrações (todos menos Marketing);
-- escrita para quem pode sincronizar (mesmos papéis da action). O cron usa
-- service role (ignora RLS).
alter table bling_sync_execucoes enable row level security;
create policy bling_sync_execucoes_select on bling_sync_execucoes
  for select using (auth.uid() is not null and public.meu_papel()::text <> 'marketing');
create policy bling_sync_execucoes_escrita on bling_sync_execucoes
  for all using (public.meu_papel()::text in ('admin', 'vendedor'))
  with check (public.meu_papel()::text in ('admin', 'vendedor'));

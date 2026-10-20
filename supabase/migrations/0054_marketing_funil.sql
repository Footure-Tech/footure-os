-- Footure OS
-- 0054_marketing_funil.sql: base de dados da visão "Funil" no detalhe da
-- campanha (fase F1). Até aqui só a etapa ATUAL de cada lead era guardada; o
-- funil precisa do caminho percorrido, do motivo de perda e das métricas de
-- topo da Meta (clique, página vista, checkout).
--
-- 1. Estágio padrão de cada etapa (os 18 funis do Kommo têm nomes diferentes):
--    entrada · tentativa · conectado · qualificado · oferta · negociacao ·
--    ganho · perdido. Sugerido pelo nome da etapa na sincronização
--    (estagioPelaEtapa em src/lib/marketing/sincronizacao.ts) e editável em
--    Configurações (estagio_manual: a sincronização não sobrescreve).
-- 2. Motivos de perda e usuários do Kommo (responsável do lead).
-- 3. Em mkt_kommo_leads: motivo de perda, responsável, tags, conjunto de
--    anúncios e utm_source. Preenchidos pela nova carga do histórico de leads
--    (a versão da normalização sobe para 3).
-- 4. mkt_kommo_movimentos: cada mudança de etapa (evento lead_status_changed),
--    desde backfill_desde — dá a etapa máxima atingida (lead perdido depois de
--    qualificado conta como qualificado) e o tempo em cada etapa.
-- 5. Meta: cliques no link, páginas vistas, checkouts iniciados e visualizações
--    de vídeo (3 s), lidos do actions_raw. O histórico já gravado é preenchido aqui.
--
-- Idempotente: pode rodar de novo.

-- 1. Estágio padrão
alter table mkt_kommo_etapas
  add column if not exists estagio text
    check (estagio in ('entrada', 'tentativa', 'conectado', 'qualificado', 'oferta', 'negociacao', 'ganho', 'perdido')),
  add column if not exists estagio_manual boolean not null default false;

-- 2. Motivos de perda e usuários
create table if not exists mkt_kommo_motivos_perda (
  id    bigint primary key,
  nome  text not null,
  sort  integer not null default 0
);

create table if not exists mkt_kommo_usuarios (
  id    bigint primary key,
  nome  text not null,
  ativo boolean not null default true
);

-- 3. Leads
alter table mkt_kommo_leads
  add column if not exists loss_reason_id bigint,
  add column if not exists responsavel_id bigint,
  add column if not exists tags           text[],
  add column if not exists adset_id       text,      -- utm_adset_id (só numérico)
  add column if not exists utm_source     text;

create index if not exists mkt_kommo_leads_loss_reason_idx on mkt_kommo_leads (loss_reason_id) where loss_reason_id is not null;

-- utm_adset_id e utm_source (campos do formulário, como utm_ad_id/utm_campaign_id).
update mkt_configuracao
   set kommo_campos = kommo_campos || '{"utm_adset_id": 1077805, "utm_source": 1077799}'::jsonb
 where not kommo_campos ? 'utm_adset_id';

-- 4. Movimentos entre etapas
create table if not exists mkt_kommo_movimentos (
  evento_id      text primary key,
  lead_id        bigint not null,
  criado_em      timestamptz not null,
  pipeline_de    bigint,
  status_de      bigint,
  pipeline_para  bigint,
  status_para    bigint,
  autor_id       bigint,          -- usuário do Kommo (0 = robô/integração)
  sincronizado_em timestamptz not null default now()
);

create index if not exists mkt_kommo_movimentos_lead_idx on mkt_kommo_movimentos (lead_id, criado_em);
create index if not exists mkt_kommo_movimentos_criado_idx on mkt_kommo_movimentos (criado_em);

-- 5. Meta: topo do funil
do $$
declare t text;
begin
  foreach t in array array['mkt_meta_campanha_dia', 'mkt_meta_anuncio_dia']
  loop
    execute format('alter table %I
      add column if not exists link_clicks        numeric(12, 2) not null default 0,
      add column if not exists landing_page_views numeric(12, 2) not null default 0,
      add column if not exists checkouts          numeric(12, 2) not null default 0,
      add column if not exists video_views        numeric(12, 2) not null default 0', t);
  end loop;
end $$;

-- Valor de uma ação no actions_raw: "value" (total) ou a soma das janelas 7d_click + 1d_view.
create or replace function pg_temp.acao_meta(acoes jsonb, tipo text) returns numeric
language sql immutable as $$
  select coalesce(sum(coalesce((a ->> 'value')::numeric, coalesce((a ->> '7d_click')::numeric, 0) + coalesce((a ->> '1d_view')::numeric, 0))), 0)
    from jsonb_array_elements(case when jsonb_typeof(acoes) = 'array' then acoes else '[]'::jsonb end) a
   where a ->> 'action_type' = tipo
$$;

do $$
declare t text;
begin
  foreach t in array array['mkt_meta_campanha_dia', 'mkt_meta_anuncio_dia']
  loop
    execute format($f$update %I set
      link_clicks        = pg_temp.acao_meta(actions_raw, 'link_click'),
      landing_page_views = pg_temp.acao_meta(actions_raw, 'landing_page_view'),
      checkouts          = pg_temp.acao_meta(actions_raw, 'offsite_conversion.fb_pixel_initiate_checkout'),
      video_views        = pg_temp.acao_meta(actions_raw, 'video_view')
    where actions_raw is not null$f$, t);
  end loop;
end $$;

-- RLS: Diretoria lê e escreve; perfil Marketing (0051) só lê. O cron usa service role.
do $$
declare t text;
begin
  foreach t in array array['mkt_kommo_motivos_perda', 'mkt_kommo_usuarios', 'mkt_kommo_movimentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all using (public.meu_papel() = ''admin'') with check (public.meu_papel() = ''admin'')', t || '_admin', t);
    execute format('drop policy if exists %I on %I', t || '_marketing_select', t);
    execute format('create policy %I on %I for select using (public.meu_papel()::text = ''marketing'')', t || '_marketing_select', t);
  end loop;
end $$;

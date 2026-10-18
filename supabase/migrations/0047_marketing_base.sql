-- Footure OS
-- 0047_marketing_base.sql: base do módulo de Marketing (fase 1a — ver
-- docs/modulo-marketing-spec.md §4.2). Mídia paga da Meta (gasto, impressões,
-- leads por dia) e leads do Kommo (MQL, venda, receita, chaves de atribuição),
-- sincronizados todo dia por cron e sob demanda pela Diretoria.
--
-- Só Diretoria (admin) lê e configura (RLS); o cron grava com service role.
-- Tokens (META_ACCESS_TOKEN, KOMMO_TOKEN…) ficam em variáveis de ambiente; aqui
-- só a configuração que não é segredo.

-- Contas de anúncio da Meta: BU = conta (regra de domínio).
create table mkt_contas (
  account_id  text primary key,            -- 'act_1286075659353257'
  bu          text not null check (bu in ('academy', 'footlink')),
  nome        text not null,
  ativa       boolean not null default true
);

insert into mkt_contas (account_id, bu, nome) values
  ('act_1286075659353257', 'academy', 'Footure Academy'),
  ('act_952448820408877', 'footlink', 'Footlink');

-- Parâmetros (uma linha): IDs de campo do Kommo, limiares do motor de
-- recomendação e janela do nível anúncio. ftp_utm_campaign é descoberto na
-- primeira sincronização (/leads/custom_fields).
create table mkt_configuracao (
  id                   boolean primary key default true check (id),
  kommo_campos         jsonb not null,
  limiares             jsonb not null,
  janela_anuncio_dias  integer not null default 90,
  backfill_desde       date not null default '2026-01-01',
  atualizado_em        timestamptz not null default now()
);

insert into mkt_configuracao (kommo_campos, limiares) values (
  '{"utm_ad_id": 1077807, "utm_content": 285142, "utm_campaign_id": 1077803, "valor_total": 1021358, "ftp_utm_campaign": null}',
  '{"roas_escalar": 2.0, "roas_piso": 1.0, "min_leads": 30, "min_vendas_confia": 3, "freq_alerta": 3.0, "cpl_piora": 1.3, "concentracao": 0.65, "maturidade_min": 0.5, "cobertura_baixa": 0.5}'
);

-- Funis do Kommo e a BU de cada um (P1): academy · footlink · fora (Footure PRO,
-- Footure Insights). Funil novo entra pela regra do nome; editável depois.
create table mkt_kommo_funis (
  pipeline_id  bigint primary key,
  nome         text not null,
  bu           text not null check (bu in ('academy', 'footlink', 'fora')),
  bu_manual    boolean not null default false,   -- definido à mão: a sincronização não sobrescreve
  sincronizado_em timestamptz not null default now()
);

-- Etapas de cada funil; eh_mql = nome contém "mql" (MQL detectado por funil).
create table mkt_kommo_etapas (
  pipeline_id  bigint not null,
  status_id    bigint not null,
  nome         text not null,
  sort         integer not null default 0,
  eh_mql       boolean not null default false,
  primary key (pipeline_id, status_id)
);

-- Um por lead (upsert). Venda = status 142, perdida = 143; receita = price ou "Valor Total".
create table mkt_kommo_leads (
  lead_id          bigint primary key,
  pipeline_id      bigint,
  status_id        bigint,
  ad_id            text,          -- numérico: utm_ad_id → utm_content
  ad_name_raw      text,          -- primeiro valor não numérico (recuperação por nome)
  campaign_id      text,          -- utm_campaign_id (só numérico)
  ftp_campaign_id  text,          -- primeiro toque pago (ftp_utm_campaign)
  is_mql           boolean not null default false,
  is_won           boolean not null default false,
  is_lost          boolean not null default false,
  revenue          numeric(12, 2) not null default 0,
  criado_em        timestamptz,
  fechado_em       timestamptz,
  atualizado_em    timestamptz,
  dias_ate_venda   numeric(8, 1),
  sincronizado_em  timestamptz not null default now()
);

create index mkt_kommo_leads_campaign_idx on mkt_kommo_leads (campaign_id);
create index mkt_kommo_leads_ad_idx on mkt_kommo_leads (ad_id);
create index mkt_kommo_leads_criado_idx on mkt_kommo_leads (criado_em);
create index mkt_kommo_leads_won_idx on mkt_kommo_leads (is_won) where is_won;

-- Meta, nível campanha (ano inteiro): uma linha por campanha por dia.
create table mkt_meta_campanha_dia (
  account_id     text not null,
  campaign_id    text not null,
  dia            date not null,
  campaign_name  text,
  spend          numeric(12, 2) not null default 0,
  impressions    bigint not null default 0,
  frequency      numeric(10, 4) not null default 0,
  leads          numeric(12, 2) not null default 0,
  purchases      numeric(12, 2) not null default 0,
  actions_raw    jsonb,
  sincronizado_em timestamptz not null default now(),
  primary key (account_id, campaign_id, dia)
);

create index mkt_meta_campanha_dia_dia_idx on mkt_meta_campanha_dia (dia);
create index mkt_meta_campanha_dia_campaign_idx on mkt_meta_campanha_dia (campaign_id);

-- Meta, nível anúncio (janela recente, 90 dias): ranking de criativos.
create table mkt_meta_anuncio_dia (
  account_id     text not null,
  ad_id          text not null,
  dia            date not null,
  campaign_id    text,
  campaign_name  text,
  adset_id       text,
  adset_name     text,
  ad_name        text,
  spend          numeric(12, 2) not null default 0,
  impressions    bigint not null default 0,
  frequency      numeric(10, 4) not null default 0,
  leads          numeric(12, 2) not null default 0,
  purchases      numeric(12, 2) not null default 0,
  actions_raw    jsonb,
  sincronizado_em timestamptz not null default now(),
  primary key (ad_id, dia)
);

create index mkt_meta_anuncio_dia_campaign_idx on mkt_meta_anuncio_dia (campaign_id, dia);
create index mkt_meta_anuncio_dia_dia_idx on mkt_meta_anuncio_dia (dia);

-- Auditoria das sincronizações; cursor permite retomar o backfill fatiado.
create table mkt_sync_execucoes (
  id              uuid primary key default gen_random_uuid(),
  fonte           text not null check (fonte in ('meta', 'kommo')),
  conta           text,
  tipo            text not null check (tipo in ('backfill', 'incremental', 'manual')),
  janela_de       date,
  janela_ate      date,
  status          text not null default 'rodando' check (status in ('rodando', 'ok', 'erro', 'parcial')),
  linhas_gravadas integer not null default 0,
  erro            text,
  cursor          jsonb,
  iniciado_em     timestamptz not null default now(),
  terminado_em    timestamptz,
  disparado_por   uuid references profiles (user_id)   -- null = cron
);

create index mkt_sync_execucoes_fonte_idx on mkt_sync_execucoes (fonte, iniciado_em desc);

-- RLS: só Diretoria. O cron usa service role (ignora RLS).
do $$
declare t text;
begin
  foreach t in array array['mkt_contas', 'mkt_configuracao', 'mkt_kommo_funis', 'mkt_kommo_etapas', 'mkt_kommo_leads',
                           'mkt_meta_campanha_dia', 'mkt_meta_anuncio_dia', 'mkt_sync_execucoes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (public.meu_papel() = ''admin'') with check (public.meu_papel() = ''admin'')', t || '_admin', t);
  end loop;
end $$;

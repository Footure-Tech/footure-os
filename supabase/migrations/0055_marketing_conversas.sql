-- Footure OS
-- 0055_marketing_conversas.sql: mensagens de WhatsApp/Instagram dos leads no
-- Kommo (fase F3 da visão Funil: conexão e velocidade de atendimento).
--
-- Uma linha por mensagem (eventos incoming_chat_message / outgoing_chat_message),
-- sem o conteúdo — só direção, horário, autor e canal. Desde backfill_desde.
-- O Kommo grava autor 0 na maioria das mensagens enviadas (automação e
-- atendimento pelo inbox), então não dá para separar robô de vendedor pelo
-- autor: a primeira mensagem (~6 min após o lead, template automático) é
-- tratada à parte do tempo de resposta do time, que conta a partir da
-- primeira resposta do lead.
--
-- mkt_resumo_conversas(de, ate): um resumo por lead criado no período, calculado
-- no banco (a página não lê as mensagens uma a uma).
--
-- Idempotente: pode rodar de novo.

create table if not exists mkt_kommo_mensagens (
  evento_id   text primary key,
  lead_id     bigint not null,
  criado_em   timestamptz not null,
  entrada     boolean not null,       -- true = o lead escreveu; false = enviada pela Footure
  autor_id    bigint,                 -- usuário do Kommo (0 = automação/integração)
  origem      text,                   -- waba, instagram_business…
  talk_id     bigint,
  sincronizado_em timestamptz not null default now()
);

create index if not exists mkt_kommo_mensagens_lead_idx on mkt_kommo_mensagens (lead_id, criado_em);
create index if not exists mkt_kommo_mensagens_criado_idx on mkt_kommo_mensagens (criado_em);

alter table mkt_kommo_mensagens enable row level security;
drop policy if exists mkt_kommo_mensagens_admin on mkt_kommo_mensagens;
create policy mkt_kommo_mensagens_admin on mkt_kommo_mensagens
  for all using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');
drop policy if exists mkt_kommo_mensagens_marketing_select on mkt_kommo_mensagens;
create policy mkt_kommo_mensagens_marketing_select on mkt_kommo_mensagens
  for select using (public.meu_papel()::text = 'marketing');

-- Resumo das conversas por lead criado em [de, ate] (datas BRT, inclusivas).
-- Roda com as permissões de quem chama (RLS das tabelas vale).
create or replace function mkt_resumo_conversas(de date, ate date)
returns table (
  lead_id                 bigint,
  primeira_saida_em       timestamptz,
  primeira_entrada_em     timestamptz,
  resposta_time_em        timestamptz,   -- 1ª mensagem enviada depois da 1ª resposta do lead
  saidas_antes_resposta   integer,
  saidas                  integer,
  entradas                integer,
  ultima_mensagem_em      timestamptz
)
language sql stable security invoker set search_path = public as $$
  with leads as (
    select l.lead_id
      from mkt_kommo_leads l
     where l.criado_em >= (de::timestamp at time zone 'America/Sao_Paulo')
       and l.criado_em <  ((ate + 1)::timestamp at time zone 'America/Sao_Paulo')
  ),
  base as (
    select m.lead_id,
           min(m.criado_em) filter (where not m.entrada) as primeira_saida_em,
           min(m.criado_em) filter (where m.entrada)     as primeira_entrada_em,
           count(*) filter (where not m.entrada)         as saidas,
           count(*) filter (where m.entrada)             as entradas,
           max(m.criado_em)                              as ultima_mensagem_em
      from mkt_kommo_mensagens m
      join leads using (lead_id)
     group by m.lead_id
  )
  select b.lead_id,
         b.primeira_saida_em,
         b.primeira_entrada_em,
         (select min(m.criado_em) from mkt_kommo_mensagens m
           where m.lead_id = b.lead_id and not m.entrada and m.criado_em > b.primeira_entrada_em),
         (select count(*) from mkt_kommo_mensagens m
           where m.lead_id = b.lead_id and not m.entrada
             and (b.primeira_entrada_em is null or m.criado_em < b.primeira_entrada_em))::integer,
         b.saidas::integer,
         b.entradas::integer,
         b.ultima_mensagem_em
    from base b
   order by b.lead_id   -- ordem estável: o PostgREST devolve no máximo 1.000 linhas por chamada
$$;

grant execute on function mkt_resumo_conversas(date, date) to authenticated;

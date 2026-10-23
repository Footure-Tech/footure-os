-- Régua de cobrança do Footlink — Fase 1 (docs/plano-cobranca-f1-f3-execucao.pdf).
--
-- Lembretes antes do vencimento, aviso no dia, cobranças de atraso e
-- escalonamento interno, por e-mail (Resend), sobre as parcelas do Bling já
-- sincronizadas (bling_parcelas). Nesta fase o boleto/Pix continua manual no
-- Banco Inter; a régua só avisa.
--
-- • cobranca_configuracao: uma linha. Começa DESLIGADA e sem data de corte —
--   nada é gerado até a Diretoria configurar.
-- • cobranca_clientes: regras por contato do Bling (pausa, régua própria,
--   destinatários extras) e o cache dos e-mails do contato no Bling.
-- • cobranca_envios: um e-mail por cliente por dia (pode reunir várias
--   parcelas); status da aprovação/envio e da entrega (webhook do Resend).
-- • cobranca_envio_itens: parcela × etapa da régua. A chave (parcela_id,
--   etapa) garante que cada etapa de cada parcela é enviada uma única vez.
--
-- Sem FK para bling_parcelas/bling_contatos: a sincronização apaga do cache o
-- que some do Bling, e o histórico de envios não pode ir junto.
-- RLS: só Diretoria (as telas e ações exigem admin); o cron e o webhook usam
-- service role.

create table cobranca_configuracao (
  id                    boolean primary key default true check (id),
  modo                  text not null default 'desligado' check (modo in ('desligado', 'aprovacao', 'automatico')),
  -- Dias em relação ao vencimento (negativo = antes). Padrão: D-3, D0, D+1, D+5, D+10.
  regua_dias            integer[] not null default '{-3,0,1,5,10}',
  escalonamento_dias    integer not null default 15,
  -- Só parcelas com vencimento a partir desta data entram na régua (null = nada entra).
  data_corte            date,
  remetente_nome        text not null default 'Footlink Financeiro',
  -- null = endereço de RESEND_FROM_EMAIL (domínio já verificado no Resend).
  remetente_email       text,
  responder_para        text[] not null default '{}',
  emails_escalonamento  text[] not null default '{}',
  -- Chave Pix exibida nos e-mails (na F1 ainda não há QR Code por cobrança).
  chave_pix             text,
  -- Homologação: preenchido, TODO e-mail ao cliente vai só para este endereço
  -- (assunto marcado [TESTE], destinatários reais no corpo do envio).
  email_teste           text,
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references profiles (user_id)
);
insert into cobranca_configuracao default values;

create table cobranca_clientes (
  contato_id            bigint primary key,   -- id do contato no Bling
  pausada               boolean not null default false,
  motivo_pausa          text,
  regua_dias            integer[],            -- null = régua padrão
  destinatarios_extra   text[] not null default '{}',
  email_bling           text,
  email_nf_bling        text,
  emails_buscados_em    timestamptz,
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references profiles (user_id)
);

create table cobranca_envios (
  id                uuid primary key default gen_random_uuid(),
  contato_id        bigint not null,
  tipo              text not null check (tipo in ('lembrete', 'vencimento', 'atraso', 'escalonamento')),
  data_prevista     date not null,
  -- pendente = aguardando aprovação (ou envio); cancelado = parcelas pagas antes do envio.
  status            text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro', 'descartado', 'cancelado')),
  destinatarios     text[] not null default '{}',
  assunto           text,
  erro              text,
  resend_id         text,
  entrega           text check (entrega in ('entregue', 'atrasada', 'devolvido', 'spam')),
  entrega_detalhe   text,
  entrega_em        timestamptz,
  criado_em         timestamptz not null default now(),
  decidido_por      uuid references profiles (user_id),
  decidido_em       timestamptz,
  enviado_em        timestamptz
);
create index cobranca_envios_status_idx on cobranca_envios (status, data_prevista desc);
create index cobranca_envios_contato_idx on cobranca_envios (contato_id, criado_em desc);
create unique index cobranca_envios_resend_idx on cobranca_envios (resend_id) where resend_id is not null;

create table cobranca_envio_itens (
  envio_id      uuid not null references cobranca_envios (id) on delete cascade,
  parcela_id    bigint not null,             -- id da conta a receber no Bling
  etapa         integer not null,            -- dias em relação ao vencimento
  vencimento    date not null,
  valor         numeric(12, 2) not null,
  rotulo        text not null,               -- "Parcela 3/12 · pedido 1234"
  primary key (parcela_id, etapa)
);
create index cobranca_envio_itens_envio_idx on cobranca_envio_itens (envio_id);

do $$
declare t text;
begin
  foreach t in array array['cobranca_configuracao', 'cobranca_clientes', 'cobranca_envios', 'cobranca_envio_itens']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (public.meu_papel()::text = ''admin'') with check (public.meu_papel()::text = ''admin'')', t || '_admin', t);
  end loop;
end $$;

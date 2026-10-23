-- Controladoria (visão do CFO) — Fase 1 (docs/modulo-controladoria-spec.md).
--
-- Cache do financeiro inteiro da Footure no Bling (contas a pagar e a
-- receber de todas as linhas, categorias, contas financeiras e formas de
-- pagamento), saldos informados pela Diretoria, premissas e o motor de alertas.
--
-- • fin_lancamentos: contas a pagar e a receber. A listagem do Bling traz
--   situação/valor/vencimento; categoria, conta financeira e histórico só vêm
--   no detalhe, buscado aos poucos (detalhado_em) — assinatura_detalhe guarda
--   o estado da listagem no momento do detalhe para saber quando rebuscar.
-- • fin_contas_financeiras: contas do Bling + camada no caixa (disponível,
--   liquidez, aplicação, gateway, cartão, ignorar) e o saldo informado à mão
--   — todas as contas da Footure no Bling são manuais (sem extrato).
-- • fin_alertas / fin_alerta_eventos: um alerta por condição (chave única);
--   some sozinho (resolvido) quando a condição deixa de existir.
-- • fin_resumos_diarios: trava do e-mail diário (um por dia).
--
-- Sem FK entre o cache e os alertas: a sincronização apaga o que some do Bling.
-- RLS: só Diretoria (admin); o cron usa service role.

create table fin_categorias (
  id               bigint primary key,
  id_pai           bigint,
  descricao        text not null,
  tipo             integer,          -- 1 despesa · 2 receita · 3+ transferências/ajustes (código do Bling)
  sincronizado_em  timestamptz not null default now()
);

create table fin_contas_financeiras (
  id                  bigint primary key,
  descricao           text not null,
  camada              text not null default 'ignorar'
                        check (camada in ('disponivel', 'liquidez', 'aplicacao', 'gateway', 'cartao', 'ignorar')),
  saldo_informado     numeric(14, 2),
  saldo_informado_em  date,
  atualizado_por      uuid references profiles (user_id),
  atualizado_em       timestamptz,
  sincronizado_em     timestamptz not null default now()
);

create table fin_formas_pagamento (
  id               bigint primary key,
  descricao        text not null,
  tipo_pagamento   integer,          -- 3 cartão de crédito, 15 boleto, 17 Pix, 18 transferência/Hotmart…
  sincronizado_em  timestamptz not null default now()
);

create table fin_contatos (
  id               bigint primary key,
  nome             text not null,
  sincronizado_em  timestamptz not null default now()
);

create table fin_lancamentos (
  id                   bigint primary key,       -- id da conta a pagar/receber no Bling
  tipo                 text not null check (tipo in ('pagar', 'receber')),
  situacao             integer not null,         -- 1 em aberto · 2 paga · 3 parcial · 4 devolvida · 5 cancelada
  vencimento           date not null,
  valor                numeric(14, 2) not null,
  saldo                numeric(14, 2),           -- em aberto (detalhe)
  data_emissao         date,
  competencia          date,
  contato_id           bigint,
  contato_nome         text,
  forma_pagamento_id   bigint,
  conta_financeira_id  bigint,
  categoria_id         bigint,
  ocorrencia_tipo      integer,                  -- 1 única · 3 parcelada · 5/7 recorrente (código do Bling)
  origem_tipo          text,
  origem_numero        text,
  tem_cobranca         boolean,                  -- receber: há link de boleto ou QR Code Pix no Bling
  historico            text,
  assinatura           text not null,            -- situacao|valor|vencimento da listagem
  assinatura_detalhe   text,
  detalhado_em         timestamptz,
  sincronizado_em      timestamptz not null default now()
);
create index fin_lancamentos_tipo_venc_idx on fin_lancamentos (tipo, vencimento);
create index fin_lancamentos_situacao_idx on fin_lancamentos (situacao, vencimento);
create index fin_lancamentos_pendentes_idx on fin_lancamentos (tipo) where detalhado_em is null;

create table fin_premissas (
  id                          boolean primary key default true check (id),
  colchao_meses               numeric(4, 1) not null default 3,
  runway_alerta_meses         numeric(4, 1) not null default 6,
  dias_conciliacao            integer not null default 7,
  excedente_meses             numeric(4, 1) not null default 2,
  despesa_subiu_pct           integer not null default 10,
  fornecedor_novo_valor       numeric(12, 2) not null default 2000,
  duplicidade_dias            integer not null default 5,
  receber_antigo_dias         integer not null default 180,
  cobranca_antecedencia_dias  integer not null default 3,
  -- Resumo diário por e-mail para a Diretoria (cron das 5h).
  resumo_diario_ativo         boolean not null default true,
  atualizado_em               timestamptz not null default now(),
  atualizado_por              uuid references profiles (user_id)
);
insert into fin_premissas default values;

create table fin_alertas (
  id               uuid primary key default gen_random_uuid(),
  chave            text not null unique,      -- regra + entidade (+ período): a mesma condição é sempre o mesmo alerta
  regra            text not null,
  grupo            text not null check (grupo in ('caixa', 'pagamentos', 'recebiveis', 'integracao')),
  severidade       text not null check (severidade in ('critico', 'atencao', 'info')),
  titulo           text not null,
  descricao        text not null,
  acao             text not null,             -- o que fazer, em uma frase
  href             text,                      -- tela da plataforma que resolve
  valor            numeric(14, 2),
  status           text not null default 'novo'
                     check (status in ('novo', 'em_tratamento', 'adiado', 'encerrado', 'resolvido')),
  responsavel_id   uuid references profiles (user_id),
  adiado_ate       date,
  motivo           text,                      -- justificativa ao adiar/encerrar
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  visto_em         timestamptz not null default now(),   -- última avaliação em que a condição existia
  resolvido_em     timestamptz
);
create index fin_alertas_status_idx on fin_alertas (status, severidade);

create table fin_alerta_eventos (
  id         uuid primary key default gen_random_uuid(),
  alerta_id  uuid not null references fin_alertas (id) on delete cascade,
  tipo       text not null check (tipo in ('criado', 'reaberto', 'atribuido', 'adiado', 'encerrado', 'reativado', 'resolvido')),
  detalhe    text,
  autor_id   uuid references profiles (user_id),   -- null = motor de alertas
  criado_em  timestamptz not null default now()
);
create index fin_alerta_eventos_alerta_idx on fin_alerta_eventos (alerta_id, criado_em desc);

create table fin_resumos_diarios (
  data           date primary key,
  enviado_em     timestamptz not null default now(),
  destinatarios  text[] not null default '{}',
  resend_id      text
);

do $$
declare t text;
begin
  foreach t in array array['fin_categorias', 'fin_contas_financeiras', 'fin_formas_pagamento', 'fin_contatos', 'fin_lancamentos',
                           'fin_premissas', 'fin_alertas', 'fin_alerta_eventos', 'fin_resumos_diarios']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (public.meu_papel()::text = ''admin'') with check (public.meu_papel()::text = ''admin'')', t || '_admin', t);
  end loop;
end $$;

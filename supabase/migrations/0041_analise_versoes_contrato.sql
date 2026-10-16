-- Footure OS
-- 0041_analise_versoes_contrato.sql: quando o jurídico sobe uma nova versão do
-- contrato, o sistema compara com a versão anterior (texto, parágrafo a
-- parágrafo), a IA resume cada mudança e sugere se é melhoria do modelo ou
-- ajuste específico do cliente, e o jurídico decide se agrega ao modelo.
--
-- • contrato_analises: uma por versão enviada (contrato_id), comparada com a
--   versão anterior (base_contrato_id).
-- • contrato_mudancas: cada mudança (alterado/incluído/removido), com o trecho
--   antes/depois, o resumo e a sugestão da IA e a decisão do jurídico.
-- • modelo_contrato_ajustes: mudanças agregadas — aplicadas automaticamente
--   nas próximas gerações do mesmo modelo (perfil clube/agente), trocando
--   trecho_original por trecho_novo. A diretoria pode desativar.

create table contrato_analises (
  id                uuid primary key default gen_random_uuid(),
  contrato_id       uuid not null unique references contratos (id) on delete cascade,
  base_contrato_id  uuid references contratos (id) on delete set null,
  status            text not null default 'pendente' check (status in ('pendente', 'concluida', 'erro')),
  resumo            text,
  resumo_ia         boolean not null default false,
  erro              text,
  criado_em         timestamptz not null default now()
);

create table contrato_mudancas (
  id               uuid primary key default gen_random_uuid(),
  analise_id       uuid not null references contrato_analises (id) on delete cascade,
  ordem            integer not null,
  clausula         text,
  tipo             text not null check (tipo in ('alterado', 'incluido', 'removido')),
  trecho_original  text not null default '',
  trecho_novo      text not null default '',
  resumo           text,
  sugestao         text check (sugestao in ('modelo', 'especifico')),
  motivo_sugestao  text,
  decisao          text not null default 'pendente' check (decisao in ('pendente', 'agregar', 'manter')),
  decidido_por     uuid references profiles (user_id),
  decidido_em      timestamptz
);

create index contrato_mudancas_analise_idx on contrato_mudancas (analise_id, ordem);

create table modelo_contrato_ajustes (
  id               uuid primary key default gen_random_uuid(),
  perfil           text not null check (perfil in ('clube', 'agente')),
  trecho_original  text not null,
  trecho_novo      text not null,
  mudanca_id       uuid references contrato_mudancas (id) on delete set null,
  ativo            boolean not null default true,
  criado_por       uuid references profiles (user_id),
  criado_em        timestamptz not null default now(),
  desativado_por   uuid references profiles (user_id),
  desativado_em    timestamptz
);

create index modelo_contrato_ajustes_ativos_idx on modelo_contrato_ajustes (perfil) where ativo;

alter table contrato_analises enable row level security;
alter table contrato_mudancas enable row level security;
alter table modelo_contrato_ajustes enable row level security;

-- Jurídico e diretoria (mesmo acesso das versões do contrato).
create policy contrato_analises_rw on contrato_analises
  for all using (public.meu_papel() in ('juridico', 'admin')) with check (public.meu_papel() in ('juridico', 'admin'));
create policy contrato_mudancas_rw on contrato_mudancas
  for all using (public.meu_papel() in ('juridico', 'admin')) with check (public.meu_papel() in ('juridico', 'admin'));
-- Ajustes: lidos na geração (feita por admin na aprovação ou pelo jurídico).
create policy modelo_contrato_ajustes_rw on modelo_contrato_ajustes
  for all using (public.meu_papel() in ('juridico', 'admin')) with check (public.meu_papel() in ('juridico', 'admin'));

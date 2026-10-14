-- Footlink — Sistema de Fechamento de Venda
-- 0027_contrato_signatarios_clicksign.sql: status de assinatura POR signatário.
-- Até aqui só sabíamos quando TODOS assinavam (webhook document_closed). Agora
-- cada signatário criado no envelope é gravado no envio (enviarParaAssinatura)
-- e o webhook `sign` marca quem assinou — o jurídico/comercial sabe de quem
-- cobrar a assinatura. Contratos enviados antes desta migration não têm linhas
-- aqui; a tela cai no status geral do pedido para eles.

create table contrato_signatarios (
  id                    uuid primary key default gen_random_uuid(),
  contrato_id           uuid not null references contratos (id) on delete cascade,
  clicksign_signer_id   text,
  nome                  text not null,
  email                 text not null,
  papel                 text not null check (papel in ('legal_representative', 'witness')),
  lado                  text not null check (lado in ('cliente', 'footure')),
  status                text not null default 'pendente' check (status in ('pendente', 'assinado', 'recusado')),
  assinado_em           timestamptz,
  ordem                 integer not null default 0,
  criado_em             timestamptz not null default now()
);

create index contrato_signatarios_contrato_id_idx on contrato_signatarios (contrato_id);

alter table contrato_signatarios enable row level security;

-- Mesma visibilidade de `contratos`: dono do pedido, jurídico e admin.
create policy contrato_signatarios_select on contrato_signatarios
  for select
  using (
    exists (
      select 1
      from contratos c
      join pedidos p on p.id = c.pedido_id
      where c.id = contrato_signatarios.contrato_id
        and (p.vendedor_id = auth.uid() or public.meu_papel() in ('juridico', 'admin'))
    )
  );

-- Gravado no envio à Clicksign (jurídico/admin). O webhook usa service role.
create policy contrato_signatarios_insert on contrato_signatarios
  for insert
  with check (public.meu_papel() in ('juridico', 'admin'));

create policy contrato_signatarios_update on contrato_signatarios
  for update
  using (public.meu_papel() in ('juridico', 'admin'))
  with check (public.meu_papel() in ('juridico', 'admin'));

-- Reenvio do contrato (envelope novo) substitui os signatários do envelope anterior.
create policy contrato_signatarios_delete on contrato_signatarios
  for delete
  using (public.meu_papel() in ('juridico', 'admin'));

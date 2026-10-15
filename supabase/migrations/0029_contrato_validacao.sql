-- Footlink — Sistema de Fechamento de Venda
-- 0029_contrato_validacao.sql: checklist de validação jurídica (tela
-- Contratos). Uma linha por item marcado, por VERSÃO do contrato — uma versão
-- nova (regenerada ou subida à mão) começa com o checklist em branco. Fica
-- registrado quem marcou e quando. Desmarcar = apagar a linha.

create table contrato_validacao (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos (id) on delete cascade,
  item         text not null check (item in ('dados_cadastrais', 'valores_parcelas', 'clausulas_padrao', 'anexo_plano')),
  marcado_por  uuid references auth.users (id),
  marcado_em   timestamptz not null default now(),
  unique (contrato_id, item)
);

create index contrato_validacao_contrato_id_idx on contrato_validacao (contrato_id);

alter table contrato_validacao enable row level security;

-- Mesma visibilidade de `contratos`: dono do pedido, jurídico e admin.
create policy contrato_validacao_select on contrato_validacao
  for select
  using (
    exists (
      select 1
      from contratos c
      join pedidos p on p.id = c.pedido_id
      where c.id = contrato_validacao.contrato_id
        and (p.vendedor_id = auth.uid() or public.meu_papel() in ('juridico', 'admin'))
    )
  );

create policy contrato_validacao_insert on contrato_validacao
  for insert
  with check (public.meu_papel() in ('juridico', 'admin'));

create policy contrato_validacao_delete on contrato_validacao
  for delete
  using (public.meu_papel() in ('juridico', 'admin'));

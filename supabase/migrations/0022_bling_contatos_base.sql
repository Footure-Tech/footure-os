-- O Bling vira a base única de identidade de cliente (razão social/CNPJ):
-- a lista de clientes passa a ser alimentada pelos contatos do Bling, não
-- mais por cadastro livre. bling_contatos é um cache local (o Bling não tem
-- filtro server-side por pessoa jurídica e a conta tem 2000+ contatos, boa
-- parte pessoa física de outro produto — sincronizar ao vivo a cada acesso à
-- tela seria inviável), atualizado sob demanda por um botão "Sincronizar".
create table bling_contatos (
  id                bigint primary key, -- id do contato no Bling
  nome              text not null,
  cnpj              text not null,
  telefone          text,
  sincronizado_em   timestamptz not null default now()
);

alter table bling_contatos enable row level security;

create policy bling_contatos_select on bling_contatos
  for select
  using (auth.uid() is not null);

create policy bling_contatos_write on bling_contatos
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Vínculo do complemento local (logo, perfil, endereço, foro, contratos,
-- pedidos) com o contato do Bling de onde vem a identidade. Nullable porque
-- os 5 clientes já cadastrados precisam ser religados por CNPJ após a
-- primeira sincronização (não dá pra fazer isso em SQL estático, depende de
-- dados reais do Bling no momento da migração).
alter table clientes add column bling_contato_id bigint references bling_contatos (id);
create unique index clientes_bling_contato_id_key on clientes (bling_contato_id) where bling_contato_id is not null;

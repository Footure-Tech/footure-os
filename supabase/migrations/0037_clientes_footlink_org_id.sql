-- Footure OS
-- 0037_clientes_footlink_org_id.sql: ID da organização do cliente no Footlink
-- (o produto) — liga o cadastro interno à conta do cliente na plataforma
-- Footlink. Só existe aqui (não é dado do Bling) e é opcional: o cliente pode
-- ainda não ter conta no Footlink. Texto livre, para aceitar o formato que o
-- Footlink usar (número ou UUID); único quando preenchido — uma organização do
-- Footlink pertence a um único cliente.

alter table clientes add column footlink_org_id text;

create unique index clientes_footlink_org_id_key on clientes (footlink_org_id) where footlink_org_id is not null;

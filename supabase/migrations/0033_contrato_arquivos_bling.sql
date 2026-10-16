-- Footure OS
-- 0033_contrato_arquivos_bling.sql: arquivo do contrato para pedidos de venda
-- que NÃO foram gerados na plataforma (só existem no Bling). A tela Financeiro
-- · Contrato permite anexar o documento (PDF assinado ou .docx); cada envio é
-- um registro novo — nada é sobrescrito, como nas versões de `contratos`.
--
-- Sem FK para bling_pedidos de propósito: a sincronização apaga do cache os
-- pedidos que somem do Bling, e o arquivo anexado não pode ir junto.
--
-- Path no bucket `contratos`: bling/{bling_pedido_id}/{arquivo}. O primeiro
-- segmento "bling" separa estes arquivos dos do fluxo da plataforma
-- ({pedido_id}/v{versao}.docx), que seguem as policies de 0003.

create table contrato_arquivos_bling (
  id               uuid primary key default gen_random_uuid(),
  bling_pedido_id  bigint not null,
  arquivo_path     text not null unique,
  nome_arquivo     text not null,
  tamanho_bytes    integer,
  enviado_por      uuid references profiles (user_id),
  enviado_em       timestamptz not null default now()
);

create index contrato_arquivos_bling_pedido_idx on contrato_arquivos_bling (bling_pedido_id);

alter table contrato_arquivos_bling enable row level security;

-- Financeiro fica sob a Diretoria (admin) — mesmo acesso da tela.
create policy contrato_arquivos_bling_select on contrato_arquivos_bling
  for select
  using (public.meu_papel() = 'admin');

create policy contrato_arquivos_bling_insert on contrato_arquivos_bling
  for insert
  with check (public.meu_papel() = 'admin');

create policy contratos_bling_storage_select on storage.objects
  for select
  using (bucket_id = 'contratos' and (storage.foldername(name))[1] = 'bling' and public.meu_papel() = 'admin');

create policy contratos_bling_storage_insert on storage.objects
  for insert
  with check (bucket_id = 'contratos' and (storage.foldername(name))[1] = 'bling' and public.meu_papel() = 'admin');

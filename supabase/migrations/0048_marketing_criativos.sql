-- Footure OS
-- 0048_marketing_criativos.sql: miniatura de cada criativo (anúncio) da Meta,
-- para ilustrar o ranking por criativo. A Meta entrega a miniatura num link
-- que expira em poucos dias; por isso a sincronização baixa a imagem e guarda
-- no Storage (bucket privado — a tela usa link assinado). Só a Diretoria lê.

create table mkt_meta_criativos (
  ad_id         text primary key,
  account_id    text not null,
  creative_id   text,
  imagem_path   text,            -- caminho no bucket marketing-criativos (null = sem miniatura na Meta)
  atualizado_em timestamptz not null default now()
);

alter table mkt_meta_criativos enable row level security;
create policy mkt_meta_criativos_admin on mkt_meta_criativos
  for all using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

insert into storage.buckets (id, name, public)
values ('marketing-criativos', 'marketing-criativos', false)
on conflict (id) do nothing;

create policy marketing_criativos_storage_select on storage.objects
  for select using (bucket_id = 'marketing-criativos' and public.meu_papel() = 'admin');
create policy marketing_criativos_storage_insert on storage.objects
  for insert with check (bucket_id = 'marketing-criativos' and public.meu_papel() = 'admin');
create policy marketing_criativos_storage_update on storage.objects
  for update using (bucket_id = 'marketing-criativos' and public.meu_papel() = 'admin');

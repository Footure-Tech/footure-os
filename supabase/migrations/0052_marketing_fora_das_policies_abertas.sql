-- Perfil "Marketing" (0051) fora das policies "qualquer usuário logado".
--
-- Várias tabelas liberam leitura/escrita para auth.uid() is not null (clientes,
-- bling_*, academy_*, signatários, contratos do Bling, logos…) — pensadas para
-- quando todos os papéis eram internos ao comercial/jurídico. Sem este ajuste,
-- o perfil Marketing leria e alteraria esses dados pela API direta, mesmo sem
-- ver as telas. Aqui cada uma dessas policies passa a exigir também
-- papel <> 'marketing'; Diretoria, Comercial e Jurídico não mudam.
--
-- profiles: o Marketing continua lendo o próprio perfil (a sessão depende dele).
-- Idempotente: policy já ajustada (menciona 'marketing') é ignorada.

do $$
declare
  p record;
  trocado constant text := '(auth.uid() IS NOT NULL AND (public.meu_papel())::text <> ''marketing'')';
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and policyname <> 'profiles_select'
      and (coalesce(qual, '') like '%auth.uid() IS NOT NULL%' or coalesce(with_check, '') like '%auth.uid() IS NOT NULL%')
      and coalesce(qual, '') not like '%marketing%'
      and coalesce(with_check, '') not like '%marketing%'
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      sql := sql || ' using (' || replace(p.qual, 'auth.uid() IS NOT NULL', trocado) || ')';
    end if;
    if p.with_check is not null then
      sql := sql || ' with check (' || replace(p.with_check, 'auth.uid() IS NOT NULL', trocado) || ')';
    end if;
    raise notice '%', sql;
    execute sql;
  end loop;
end $$;

alter policy profiles_select on profiles
  using (user_id = auth.uid() or (auth.uid() is not null and public.meu_papel()::text <> 'marketing'));

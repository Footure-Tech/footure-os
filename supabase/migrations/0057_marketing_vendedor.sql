-- Perfil "Vendedor" no módulo de Marketing, com o mesmo acesso do perfil
-- Marketing (0051, 0054, 0055): lê as tabelas mkt_* e as miniaturas e grava
-- só o que as ações da tela da campanha gravam (sugestões/estratégias por IA,
-- verificação de rastreio e releitura dos parâmetros dos anúncios).
-- Sincronização, configuração e BU/estágios dos funis continuam só da Diretoria.
--
-- As policies do Marketing passam a aceitar os dois papéis — uma regra só
-- por tabela, sem duplicar policy para o Vendedor.
-- Idempotente: pode rodar de novo.

-- Leitura das tabelas do módulo.
do $$
declare t text;
begin
  foreach t in array array['mkt_contas', 'mkt_configuracao', 'mkt_kommo_funis', 'mkt_kommo_etapas', 'mkt_kommo_leads',
                           'mkt_meta_campanha_dia', 'mkt_meta_anuncio_dia', 'mkt_sync_execucoes',
                           'mkt_meta_criativos', 'mkt_sugestoes_ia', 'mkt_verificacoes_rastreio',
                           'mkt_kommo_motivos_perda', 'mkt_kommo_usuarios', 'mkt_kommo_movimentos',
                           'mkt_kommo_mensagens']
  loop
    execute format('alter policy %I on %I using (public.meu_papel()::text in (''marketing'', ''vendedor''))', t || '_marketing_select', t);
  end loop;
end $$;

-- "Verificar parâmetros de novo".
alter policy mkt_meta_criativos_marketing_update on mkt_meta_criativos
  using (public.meu_papel()::text in ('marketing', 'vendedor'))
  with check (public.meu_papel()::text in ('marketing', 'vendedor'));

-- "Gerar novas sugestões" / "Gerar novas estratégias".
alter policy mkt_sugestoes_ia_marketing_insert on mkt_sugestoes_ia
  with check (public.meu_papel()::text in ('marketing', 'vendedor'));

-- Verificação de ponta a ponta.
alter policy mkt_verificacoes_rastreio_marketing_insert on mkt_verificacoes_rastreio
  with check (public.meu_papel()::text in ('marketing', 'vendedor'));
alter policy mkt_verificacoes_rastreio_marketing_update on mkt_verificacoes_rastreio
  using (public.meu_papel()::text in ('marketing', 'vendedor'))
  with check (public.meu_papel()::text in ('marketing', 'vendedor'));

-- Miniaturas dos criativos.
alter policy marketing_criativos_storage_select_marketing on storage.objects
  using (bucket_id = 'marketing-criativos' and public.meu_papel()::text in ('marketing', 'vendedor'));

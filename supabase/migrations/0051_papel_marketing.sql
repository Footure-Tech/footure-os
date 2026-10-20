-- Perfil "Marketing": acesso só ao módulo de Marketing (Desempenho de
-- campanhas, detalhe da campanha e Investimento × Retorno).
--
-- • Lê as tabelas mkt_* e as miniaturas (bucket marketing-criativos).
-- • Escreve só o que as ações da tela da campanha gravam: sugestões por IA,
--   verificação de rastreio e a releitura dos parâmetros dos anúncios.
-- • Sincronização, configuração e BU dos funis continuam só da Diretoria.
--
-- As policies comparam meu_papel()::text (e não o literal do enum): o valor
-- novo do enum não pode ser usado na mesma transação em que é criado.
-- Idempotente: pode rodar de novo.

alter type papel_usuario add value if not exists 'marketing';

-- Leitura das tabelas do módulo.
do $$
declare t text;
begin
  foreach t in array array['mkt_contas', 'mkt_configuracao', 'mkt_kommo_funis', 'mkt_kommo_etapas', 'mkt_kommo_leads',
                           'mkt_meta_campanha_dia', 'mkt_meta_anuncio_dia', 'mkt_sync_execucoes',
                           'mkt_meta_criativos', 'mkt_sugestoes_ia', 'mkt_verificacoes_rastreio']
  loop
    execute format('drop policy if exists %I on %I', t || '_marketing_select', t);
    execute format('create policy %I on %I for select using (public.meu_papel()::text = ''marketing'')', t || '_marketing_select', t);
  end loop;
end $$;

-- "Verificar parâmetros de novo": atualiza destino, parâmetros e status do anúncio.
drop policy if exists mkt_meta_criativos_marketing_update on mkt_meta_criativos;
create policy mkt_meta_criativos_marketing_update on mkt_meta_criativos
  for update using (public.meu_papel()::text = 'marketing') with check (public.meu_papel()::text = 'marketing');

-- "Gerar novas sugestões": grava a rodada.
drop policy if exists mkt_sugestoes_ia_marketing_insert on mkt_sugestoes_ia;
create policy mkt_sugestoes_ia_marketing_insert on mkt_sugestoes_ia
  for insert with check (public.meu_papel()::text = 'marketing');

-- Verificação de ponta a ponta: cria e grava o resultado.
drop policy if exists mkt_verificacoes_rastreio_marketing_insert on mkt_verificacoes_rastreio;
create policy mkt_verificacoes_rastreio_marketing_insert on mkt_verificacoes_rastreio
  for insert with check (public.meu_papel()::text = 'marketing');
drop policy if exists mkt_verificacoes_rastreio_marketing_update on mkt_verificacoes_rastreio;
create policy mkt_verificacoes_rastreio_marketing_update on mkt_verificacoes_rastreio
  for update using (public.meu_papel()::text = 'marketing') with check (public.meu_papel()::text = 'marketing');

-- Miniaturas dos criativos (links assinados exigem leitura).
drop policy if exists marketing_criativos_storage_select_marketing on storage.objects;
create policy marketing_criativos_storage_select_marketing on storage.objects
  for select using (bucket_id = 'marketing-criativos' and public.meu_papel()::text = 'marketing');

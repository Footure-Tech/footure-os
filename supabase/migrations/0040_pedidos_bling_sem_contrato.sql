-- Footure OS
-- 0040_pedidos_bling_sem_contrato.sql: integração do pedido de venda com o
-- Bling (POST /pedidos/vendas na aprovação) e pedidos SEM contrato.
--
-- • gera_contrato: o vendedor marca se o pedido gera contrato (padrão sim).
--   Sem contrato (ex.: alguns agentes), a aprovação da Diretoria envia o
--   pedido ao Bling e encerra o fluxo — sem jurídico nem assinatura. Por isso
--   registrar_transicao ganha aprovado -> concluido, só para esses pedidos.
-- • emails_financeiro: um ou mais e-mails do financeiro do cliente (vão para
--   as observações internas do pedido no Bling, como o Pluga fazia).
-- • bling_pedido_numero / bling_enviado_em / bling_erro: resultado do envio
--   (bling_pedido_id já existia em 0001). Com erro, o pedido não trava: fica
--   o motivo e o botão "Reenviar ao Bling".

alter table pedidos
  add column gera_contrato boolean not null default true,
  add column emails_financeiro text[] not null default '{}',
  add column bling_pedido_numero text,
  add column bling_enviado_em timestamptz,
  add column bling_erro text;

create or replace function public.registrar_transicao(
  p_pedido_id uuid,
  p_para status_pedido,
  p_comentario text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_de status_pedido;
  v_gera_contrato boolean;
  v_papel papel_usuario;
  v_permitido boolean;
begin
  select status, gera_contrato into v_de, v_gera_contrato from pedidos where id = p_pedido_id for update;
  if v_de is null then
    raise exception 'Pedido % não encontrado', p_pedido_id;
  end if;

  v_papel := public.meu_papel();

  v_permitido := case
    when v_de = 'rascunho' and p_para = 'em_aprovacao' and v_papel in ('vendedor', 'admin') then true
    when v_de = 'em_aprovacao' and p_para = 'aprovado' and v_papel = 'admin' then true
    when v_de = 'em_aprovacao' and p_para = 'rascunho' and v_papel in ('admin', 'vendedor') then true
    when v_de = 'aprovado' and p_para = 'em_revisao_juridica' and v_papel in ('admin', 'juridico') then true
    when v_de = 'aprovado' and p_para = 'rascunho' and v_papel in ('vendedor', 'admin') then true
    -- 0040: pedido SEM contrato — depois de enviado ao Bling, a aprovação encerra o fluxo.
    when v_de = 'aprovado' and p_para = 'concluido' and not v_gera_contrato and v_papel = 'admin' then true
    when v_de = 'em_revisao_juridica' and p_para = 'pronto_para_assinatura' and v_papel in ('juridico', 'admin') then true
    when v_de = 'em_revisao_juridica' and p_para = 'aprovado' and v_papel in ('juridico', 'admin') then true
    when v_de = 'em_revisao_juridica' and p_para = 'rascunho' and v_papel in ('vendedor', 'admin') then true
    when v_de = 'pronto_para_assinatura' and p_para = 'enviado_para_assinatura' and v_papel in ('juridico', 'admin') then true
    when v_de = 'pronto_para_assinatura' and p_para = 'em_revisao_juridica' and v_papel in ('juridico', 'admin') then true
    when v_de = 'enviado_para_assinatura' and p_para = 'em_revisao_juridica' and v_papel in ('juridico', 'admin') then true
    when v_de = 'enviado_para_assinatura' and p_para = 'assinado' then true
    when v_de = 'assinado' and p_para = 'concluido' and v_papel in ('juridico', 'admin') then true
    when p_para = 'cancelado' and v_de not in ('concluido', 'cancelado') and v_papel in ('vendedor', 'admin', 'juridico') then true
    else false
  end;

  if not v_permitido then
    raise exception 'Transição % -> % não permitida para o papel %', v_de, p_para, coalesce(v_papel::text, '(nenhum)');
  end if;

  insert into transicoes (pedido_id, de, para, ator_id, comentario)
  values (p_pedido_id, v_de, p_para, auth.uid(), p_comentario);

  update pedidos set status = p_para where id = p_pedido_id;
end;
$$;

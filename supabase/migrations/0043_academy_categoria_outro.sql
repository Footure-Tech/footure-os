-- Footure OS
-- 0043_academy_categoria_outro.sql: categoria "outro" em academy_vendas para
-- produtos da loja do Academy que não são curso (ex.: camiseta, licença de
-- teste do Footlink) — ficam no cache, mas não contam como venda.

alter table academy_vendas drop constraint academy_vendas_categoria_check;
alter table academy_vendas add constraint academy_vendas_categoria_check
  check (categoria in ('especializacao', 'livre', 'assinatura', 'mensalidade', 'outro'));

update academy_vendas set categoria = 'outro'
where produto ~* '(camiseta|licen[çc]a teste)';

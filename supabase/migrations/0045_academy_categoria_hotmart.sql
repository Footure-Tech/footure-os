-- Footure OS
-- 0045_academy_categoria_hotmart.sql: categoria "hotmart" em academy_vendas —
-- vendas feitas pela Hotmart, que o Bling registra com um item genérico (o nome
-- da empresa, "FOOTURE PRODUTORA DE CONTEUDO…"), sem o curso. Contam como venda
-- do Academy, num grupo à parte ("Hotmart (curso não identificado)"), até a
-- integração com a Hotmart trazer o curso. "The Board" passa a "outro" (serviço).

alter table academy_vendas drop constraint academy_vendas_categoria_check;
alter table academy_vendas add constraint academy_vendas_categoria_check
  check (categoria in ('especializacao', 'livre', 'hotmart', 'assinatura', 'mensalidade', 'outro'));

update academy_vendas set categoria = 'hotmart' where produto ~* '^footure produtora';
update academy_vendas set categoria = 'outro' where produto ~* '^the board$';

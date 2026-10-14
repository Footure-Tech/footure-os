-- Footlink — Sistema de Fechamento de Venda
-- 0028_contratos_assinatura_incompleta.sql: processo de assinatura encerrado
-- SEM todas as assinaturas (prazo expirou, ou o documento foi finalizado com
-- signatários pendentes). Nesses casos o pedido NÃO vai para "assinado": fica
-- em enviado_para_assinatura com este registro, a tela mostra quem não assinou
-- e o jurídico decide entre reenviar ou estender o prazo.
alter table contratos add column assinatura_encerrada_em timestamptz;
alter table contratos add column assinatura_incompleta boolean not null default false;

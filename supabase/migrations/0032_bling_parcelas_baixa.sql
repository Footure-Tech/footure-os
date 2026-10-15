-- Footlink — Sistema de Fechamento de Venda
-- 0032_bling_parcelas_baixa.sql: data e valor da baixa (pagamento) de cada
-- parcela. A listagem /contas/receber do Bling não traz isso — a data fica no
-- borderô (GET /contas/receber/{id} -> borderos -> GET /borderos/{id}.data) e
-- o valor pago sai de valor − saldo do detalhe da conta. Exige o escopo
-- "Borderôs" no app do Bling. Buscado só para parcelas pagas (total ou
-- parcialmente) cuja situação mudou desde a última busca — situacao_detalhada
-- guarda a situação em que o detalhe foi lido.
alter table bling_parcelas add column data_pagamento date;
alter table bling_parcelas add column valor_pago numeric(12, 2);
alter table bling_parcelas add column situacao_detalhada integer;

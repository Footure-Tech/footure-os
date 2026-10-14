-- Lista de clientes passa a mostrar parcelas emitidas/total (e quantas em
-- atraso) em vez de contagem de pedidos — resumo pré-calculado na
-- sincronização (ver sincronizarContatosBling), reaproveitando as parcelas
-- que já são buscadas ali pra checar atraso, sem chamada extra ao Bling.
alter table bling_contatos add column total_parcelas integer not null default 0;
alter table bling_contatos add column parcelas_emitidas integer not null default 0;
alter table bling_contatos add column parcelas_atrasadas integer not null default 0;

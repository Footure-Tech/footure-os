-- A lista de clientes só mostrava pedidos/situação de quem tinha pedido
-- LOCAL (tabela pedidos, nosso processo de venda) — a maioria dos 134
-- clientes reais vem só do Bling, sem nunca ter passado pelo nosso fluxo de
-- pedido, e aparecia com "0 pedidos"/"sem contrato" mesmo tendo pedido de
-- venda e parcelas reais lá. Resumo pré-calculado na sincronização (ver
-- sincronizarContatosBling) — contar/checar atraso ao vivo pra 134+ clientes
-- a cada carregamento da tela estouraria o limite de 3 req/s do Bling.
alter table bling_contatos add column total_pedidos_venda integer not null default 0;
alter table bling_contatos add column tem_parcela_atrasada boolean not null default false;

-- "Em dia" só faz sentido quando existe parcela futura em aberto — um
-- cliente com todas as parcelas já recebidas (ou nenhuma parcela, encerrado
-- de fato) estava caindo em "em dia" por engano, só por não ter nenhuma
-- atrasada. Ver sincronizarContatosBling/calcularSituacaoCliente.
alter table bling_contatos add column tem_parcela_a_vencer boolean not null default false;

-- Endereço do cliente passa de texto livre pra campos estruturados no
-- padrão do Bling (endereco.geral: logradouro/número/complemento/bairro/
-- CEP/município/UF) — necessário pra quando a integração de pedido de venda
-- com o Bling for implementada, já que o endereço precisa ser enviado campo
-- a campo, não como um bloco de texto.
--
-- O texto livre dos 5 clientes já cadastrados vai pra endereco_legado (só
-- leitura, nunca mais escrito) em vez de tentar parsear automaticamente —
-- os formatos são todos diferentes entre si (vírgula, hífen, travessão,
-- abreviações distintas) e um parser teria risco real de errar o CEP/UF
-- num contrato. Esses 5 ficam com os campos estruturados vazios até alguém
-- reeditar o cadastro; endereco_legado aparece como referência no formulário
-- enquanto isso.
alter table clientes rename column endereco to endereco_legado;
alter table clientes alter column endereco_legado drop not null;

alter table clientes add column endereco      text; -- logradouro
alter table clientes add column numero        text;
alter table clientes add column complemento   text;
alter table clientes add column bairro        text;
alter table clientes add column cep           text;
alter table clientes add column municipio     text;
alter table clientes add column uf            text;

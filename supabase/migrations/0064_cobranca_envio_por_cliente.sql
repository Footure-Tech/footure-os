-- Régua de cobrança — Fase 2: janela de envio da cobrança (boleto + Pix) por
-- cliente. Padrão: cobranca_configuracao.inter_antecedencia_dias (10). O
-- cliente pode ter antecedência própria ou "até o dia X do mês" — a cobrança
-- sai no último dia X antes do vencimento (ex.: X = 20 → vencimento 10/12 sai
-- em 20/11; vencimento 25/12 sai em 20/12). Com os dois preenchidos, vale o dia.

alter table cobranca_clientes
  add column cobranca_antecedencia_dias integer check (cobranca_antecedencia_dias between 1 and 45),
  add column cobranca_dia_mes           integer check (cobranca_dia_mes between 1 and 28);

-- Régua de cobrança — Fase 2: novo tipo de envio "cobranca" — o e-mail que
-- leva o boleto + Pix do Banco Inter na antecedência configurada
-- (cobranca_configuracao.inter_antecedencia_dias). O boleto é emitido na hora
-- do envio (src/lib/cobranca/boletos.ts).

alter table cobranca_envios drop constraint if exists cobranca_envios_tipo_check;
alter table cobranca_envios add constraint cobranca_envios_tipo_check
  check (tipo in ('cobranca', 'lembrete', 'vencimento', 'atraso', 'escalonamento'));

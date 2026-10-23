-- Régua de cobrança — Fase 2: boleto + QR Code Pix pelo Banco Inter
-- (docs/plano-cobranca-f1-f3-execucao.pdf). Cliente da API em
-- src/lib/integracoes/inter.ts.
--
-- • cobranca_boletos: cada cobrança do Inter ligada a uma parcela do Bling.
--   origem 'sistema' = emitida pela régua; 'manual' = emitida à mão no Inter e
--   vinculada pela conciliação (CPF/CNPJ do pagador + vencimento + valor —
--   os boletos manuais não trazem a parcela). No máximo UM boleto válido por
--   parcela (índice único parcial): nunca emitir em duplicidade.
-- • cobranca_inter_eventos: cada aviso do webhook do Inter, bruto, para
--   auditoria. O aviso só dispara uma reconsulta da cobrança na API — o
--   conteúdo do aviso não é tomado como verdade.
-- • cobranca_configuracao: parâmetros da F2. A emissão nasce DESLIGADA e sem
--   data de corte; multa, juros e a conta/categoria da baixa no Bling ficam
--   vazias até a Diretoria decidir.

create table cobranca_boletos (
  id                    uuid primary key default gen_random_uuid(),
  parcela_id            bigint not null,          -- conta a receber no Bling
  contato_id            bigint not null,
  bling_pedido_id       bigint,
  origem                text not null check (origem in ('sistema', 'manual')),
  codigo_solicitacao    text not null unique,     -- id da cobrança no Inter
  seu_numero            text,
  valor                 numeric(12, 2) not null,
  vencimento            date not null,
  situacao              text not null,            -- A_RECEBER, ATRASADO, RECEBIDO, MARCADO_RECEBIDO, CANCELADO, EXPIRADO…
  nosso_numero          text,
  linha_digitavel       text,
  codigo_barras         text,
  pix_copia_e_cola      text,
  txid                  text,
  valor_recebido        numeric(12, 2),
  recebido_em           date,
  origem_recebimento    text,                     -- BOLETO ou PIX
  baixa_bling_em        timestamptz,
  baixa_bling_erro      text,
  emitido_em            timestamptz not null default now(),
  emitido_por           uuid references profiles (user_id),
  cancelado_em          timestamptz,
  motivo_cancelamento   text,
  atualizado_em         timestamptz not null default now(),
  teste                 boolean not null default false
);
create unique index cobranca_boletos_um_valido_por_parcela on cobranca_boletos (parcela_id)
  where situacao not in ('CANCELADO', 'EXPIRADO', 'FALHA_EMISSAO');
create index cobranca_boletos_contato_idx on cobranca_boletos (contato_id, vencimento desc);
create index cobranca_boletos_situacao_idx on cobranca_boletos (situacao, vencimento);

create table cobranca_inter_eventos (
  id            uuid primary key default gen_random_uuid(),
  recebido_em   timestamptz not null default now(),
  payload       jsonb not null,
  processado    boolean not null default false,
  erro          text
);
create index cobranca_inter_eventos_recebido_idx on cobranca_inter_eventos (recebido_em desc);

alter table cobranca_configuracao
  add column inter_emissao_ativa            boolean not null default false,
  add column inter_antecedencia_dias        integer not null default 10 check (inter_antecedencia_dias between 1 and 30),
  add column inter_multa_percentual         numeric(5, 2) check (inter_multa_percentual between 0 and 10),
  add column inter_juros_mensal_percentual  numeric(5, 2) check (inter_juros_mensal_percentual between 0 and 10),
  -- Dias depois do vencimento em que o boleto ainda pode ser pago (limite do Inter: 60).
  add column inter_dias_validade            integer not null default 30 check (inter_dias_validade between 0 and 60),
  add column inter_data_corte               date,
  add column bling_baixa_portador_id        bigint,
  add column bling_baixa_categoria_id       bigint;

do $$
declare t text;
begin
  foreach t in array array['cobranca_boletos', 'cobranca_inter_eventos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (public.meu_papel()::text in (''admin'', ''financeiro'')) with check (public.meu_papel()::text in (''admin'', ''financeiro''))', t || '_operacao', t);
  end loop;
end $$;

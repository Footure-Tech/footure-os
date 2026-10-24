-- Controladoria — movimentos de Caixa e Bancos do Bling (/caixas).
--
-- Validado em 24/10/2026 (docs/financeiro/DIVERGENCIAS.md): os movimentos
-- reproduzem o balancete do Bling centavo a centavo (set/2026) e o saldo
-- acumulado bate com o balancete a menos de um saldo de abertura constante.
-- São a fonte do regime de CAIXA (data efetiva) e completam a DRE com os
-- lançamentos feitos direto no caixa (tarifas, taxas, rendimentos), que não
-- existem em contas a pagar/receber.
--
-- • A listagem traz data, débito/crédito, valor e conta; categoria,
--   competência, origem (borderô = baixa de título; caixa = lançamento direto)
--   e o marcador de transferência só vêm no detalhe (detalhado_em).
-- • debito_credito 'S' existe no Bling (raro) e não entra no balancete.

create table fin_caixa_movimentos (
  id                   bigint primary key,      -- id do lançamento de caixa no Bling
  data                 date not null,
  debito_credito       text not null,           -- 'C' crédito · 'D' débito · 'S' (fora do balancete)
  valor                numeric(14, 2) not null, -- sempre positivo
  situacao             text,
  conta_financeira_id  bigint,
  competencia          date,
  categoria_id         bigint,
  transferencia        boolean,                 -- transferência entre contas: fora dos totais
  tipo_lancamento      text,
  origem_tipo          text,                    -- 'bordero' | 'caixa' | null
  origem_id            bigint,
  assinatura           text not null,           -- data|D/C|valor|conta da listagem
  assinatura_detalhe   text,
  detalhado_em         timestamptz,
  sincronizado_em      timestamptz not null default now()
);
create index fin_caixa_movimentos_data_idx on fin_caixa_movimentos (data);
create index fin_caixa_movimentos_pendentes_idx on fin_caixa_movimentos (data) where detalhado_em is null;

-- Saldo inicial cadastrado em cada conta no Bling (parte do saldo do balancete
-- que não aparece como movimento).
alter table fin_contas_financeiras add column saldo_inicial numeric(14, 2);

-- Ajuste de abertura do caixa: diferença constante entre a soma dos movimentos
-- e o saldo do balancete (premissa calibrada; exibida na tela).
alter table fin_premissas add column saldo_abertura_ajuste numeric(14, 2) not null default 0;
alter table fin_premissas add column saldo_abertura_referencia text;

alter table fin_caixa_movimentos enable row level security;
create policy fin_caixa_movimentos_admin on fin_caixa_movimentos
  for all using (public.meu_papel()::text = 'admin') with check (public.meu_papel()::text = 'admin');

-- Régua de cobrança: envios gerados em modo de teste (cobranca_configuracao.email_teste).
-- Eles registram parcela × etapa como qualquer envio; sem a marca, ao sair do
-- teste essas etapas seriam puladas nos envios reais. Ao limpar o e-mail de
-- teste, a configuração apaga os envios de teste (e seus itens, em cascata).

alter table cobranca_envios add column teste boolean not null default false;

-- Perfil "Financeiro" (operação da cobrança): vê a área Financeiro (Contratos,
-- Pagamentos, Inadimplência, Régua de cobrança), opera a régua e sincroniza o
-- Bling. Nas demais tabelas segue as policies "qualquer usuário logado" (como o
-- comercial). Policies comparam meu_papel()::text: o valor novo do enum não
-- pode ser usado na mesma transação em que é criado (mesmo motivo de 0051).
alter type papel_usuario add value if not exists 'financeiro';

do $$
declare t text;
begin
  foreach t in array array['cobranca_configuracao', 'cobranca_clientes', 'cobranca_envios', 'cobranca_envio_itens']
  loop
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('drop policy if exists %I on %I', t || '_operacao', t);
    execute format('create policy %I on %I for all using (public.meu_papel()::text in (''admin'', ''financeiro'')) with check (public.meu_papel()::text in (''admin'', ''financeiro''))', t || '_operacao', t);
  end loop;
end $$;

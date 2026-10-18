// Tipos escritos à mão a partir de supabase/migrations/0001_init.sql — não há
// projeto Supabase conectado ainda para rodar `supabase gen types`. Quando
// houver um projeto real, regenerar com:
//   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// e conferir se nada divergiu do que está aqui.

export type PapelUsuario = "vendedor" | "juridico" | "admin";
export type TipoCliente = "clube" | "agente";
/** 0047 · Marketing */
export type BuMarketing = "academy" | "footlink";
export type BuFunil = BuMarketing | "fora";
export interface KommoCampos {
  utm_ad_id: number;
  utm_content: number;
  utm_campaign_id: number;
  valor_total: number;
  ftp_utm_campaign: number | null;
}
export interface LimiaresMarketing {
  roas_escalar: number;
  roas_piso: number;
  min_leads: number;
  min_vendas_confia: number;
  freq_alerta: number;
  cpl_piora: number;
  concentracao: number;
  maturidade_min: number;
  cobertura_baixa: number;
}
export type LeadKommoRow = {
  lead_id: number;
  pipeline_id: number | null;
  status_id: number | null;
  ad_id: string | null;
  ad_name_raw: string | null;
  campaign_id: string | null;
  ftp_campaign_id: string | null;
  is_mql: boolean;
  is_won: boolean;
  is_lost: boolean;
  revenue: number;
  criado_em: string | null;
  fechado_em: string | null;
  atualizado_em: string | null;
  dias_ate_venda: number | null;
  sincronizado_em: string;
};
type MetaDiaBase = {
  account_id: string;
  dia: string;
  campaign_id: string | null;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  frequency: number;
  leads: number;
  purchases: number;
  actions_raw: unknown;
  sincronizado_em: string;
};
export type MetaCampanhaDiaRow = MetaDiaBase & { campaign_id: string };
export type MetaAnuncioDiaRow = MetaDiaBase & { ad_id: string; adset_id: string | null; adset_name: string | null; ad_name: string | null };
export type SugestaoIaRow = {
  id: string;
  campanha_chave: string;
  campanha_nome: string;
  periodo: "30d" | "90d";
  periodo_de: string;
  periodo_ate: string;
  modelo: string;
  tokens_entrada: number;
  tokens_saida: number;
  custo_usd: number;
  entrada: unknown;
  resultado: unknown;
  criado_por: string | null;
  criado_em: string;
};
export type SyncExecucaoRow = {
  id: string;
  fonte: "meta" | "kommo";
  conta: string | null;
  tipo: "backfill" | "incremental" | "manual";
  janela_de: string | null;
  janela_ate: string | null;
  status: "rodando" | "ok" | "erro" | "parcial";
  linhas_gravadas: number;
  erro: string | null;
  cursor: Record<string, unknown> | null;
  iniciado_em: string;
  terminado_em: string | null;
  disparado_por: string | null;
};

/** 0042/0043/0045: classificação dos produtos do Footure Academy. */
export type CategoriaAcademy = "especializacao" | "livre" | "hotmart" | "assinatura" | "mensalidade" | "outro";
/** 0044: uma parcela do pedido de venda do Academy, com a forma de pagamento e a taxa cadastrada nela. */
export interface PagamentoAcademy {
  formaId: number;
  descricao: string;
  meio: "cartao" | "pix" | "boleto" | "outro";
  /** Parcelas do cartão (da descrição da forma, ex.: "12x"); 1 sem indicação; null fora do cartão. */
  parcelasCartao: number | null;
  valor: number;
  /** Taxa da forma de pagamento: alíquota (%) e valor fixo (R$). */
  aliquota: number;
  taxaFixa: number;
}
/** 0038: tipo de venda e origem de uma venda do Bling. */
export type TipoVenda = "novo" | "renovacao" | "reativacao";
export type OrigemVenda = "carteira" | "inbound" | "outbound";
export type StatusPedido =
  | "rascunho"
  | "em_aprovacao"
  | "aprovado"
  | "em_revisao_juridica"
  | "pronto_para_assinatura"
  | "enviado_para_assinatura"
  | "assinado"
  | "concluido"
  | "cancelado";
export type FormaPagamento = "avista" | "parcelado";
export type ConvencaoParcelas = "calendario" | "ciclo";
export type MeioPagamento = "boleto" | "pix" | "transferencia_bancaria" | "cartao_credito" | "cartao_debito";
export type TipoSignatario = "representante_legal" | "testemunha";
export type Divulgacao = "nenhuma" | "simples" | "obrigacao";
export type ApiModelo = "combinado" | "distintos";
export type MultaTipo =
  | "sem_multa"
  | "duas_mensalidades"
  | "tres_mensalidades"
  | "retencao_total"
  | "customizado";
export type StatusRevisaoContrato = "pendente" | "aprovado";
export type BaseCalculoComissao = "valor_total" | "valor_recebido";
export type EscopoComissao = "global" | "por_vendedor" | "por_plano" | "por_pagamento";
export type StatusComissao = "previsto" | "confirmado" | "pago";
export type Produto = "footlink" | "api";
export type PapelAssinaturaClicksign = "legal_representative" | "witness";
export type LadoSignatario = "cliente" | "footure";
export type StatusAssinaturaSignatario = "pendente" | "assinado" | "recusado";
export type ItemValidacaoContrato = "dados_cadastrais" | "valores_parcelas" | "clausulas_padrao" | "anexo_plano";

// supabase-js exige Row/Insert/Update/Relationships em cada tabela, e
// Tables/Views/Functions como irmãos no schema — sem isso a inferência de
// tipos das queries (`.select("col")` etc.) cai silenciosamente para `never`.
type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        { user_id: string; nome: string; papel: PapelUsuario; ativo: boolean; criado_em: string },
        { user_id: string; nome: string; papel?: PapelUsuario; ativo?: boolean },
        { nome?: string; papel?: PapelUsuario; ativo?: boolean }
      >;
      clientes: TableDef<
        {
          id: string;
          tipo: TipoCliente;
          razao_social: string;
          nome_fantasia: string | null;
          apelido: string | null;
          // 0037_clientes_footlink_org_id.sql
          footlink_org_id: string | null;
          cnpj: string;
          endereco: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          cep: string | null;
          municipio: string | null;
          uf: string | null;
          endereco_legado: string | null;
          foro_preferencial: string;
          logo_path: string | null;
          bling_contato_id: number | null;
          criado_em: string;
          atualizado_em: string;
        },
        {
          id?: string;
          tipo: TipoCliente;
          razao_social: string;
          nome_fantasia?: string | null;
          apelido?: string | null;
          footlink_org_id?: string | null;
          cnpj: string;
          endereco?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cep?: string | null;
          municipio?: string | null;
          uf?: string | null;
          foro_preferencial?: string;
          logo_path?: string | null;
          bling_contato_id?: number | null;
        },
        {
          tipo?: TipoCliente;
          razao_social?: string;
          nome_fantasia?: string | null;
          apelido?: string | null;
          footlink_org_id?: string | null;
          cnpj?: string;
          endereco?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cep?: string | null;
          municipio?: string | null;
          uf?: string | null;
          foro_preferencial?: string;
          logo_path?: string | null;
          bling_contato_id?: number | null;
        }
      >;
      bling_contatos: TableDef<
        {
          id: number;
          nome: string;
          cnpj: string;
          telefone: string | null;
          total_pedidos_venda: number;
          tem_parcela_atrasada: boolean;
          tem_parcela_a_vencer: boolean;
          total_parcelas: number;
          parcelas_emitidas: number;
          parcelas_atrasadas: number;
          sincronizado_em: string;
        },
        {
          id: number;
          nome: string;
          cnpj: string;
          telefone?: string | null;
          total_pedidos_venda?: number;
          tem_parcela_atrasada?: boolean;
          tem_parcela_a_vencer?: boolean;
          total_parcelas?: number;
          parcelas_emitidas?: number;
          parcelas_atrasadas?: number;
          sincronizado_em?: string;
        },
        {
          nome?: string;
          cnpj?: string;
          telefone?: string | null;
          total_pedidos_venda?: number;
          tem_parcela_atrasada?: boolean;
          tem_parcela_a_vencer?: boolean;
          total_parcelas?: number;
          parcelas_emitidas?: number;
          parcelas_atrasadas?: number;
          sincronizado_em?: string;
        }
      >;
      signatarios_cliente: TableDef<
        {
          id: string;
          cliente_id: string;
          tipo: TipoSignatario;
          nome_completo: string;
          email: string;
          cpf: string;
          criado_em: string;
        },
        {
          id?: string;
          cliente_id: string;
          tipo: TipoSignatario;
          nome_completo: string;
          email: string;
          cpf: string;
        },
        { tipo?: TipoSignatario; nome_completo?: string; email?: string; cpf?: string }
      >;
      representantes_footure: TableDef<
        { id: string; nome: string; cargo: string; email: string | null; cpf: string | null; ativo: boolean },
        { id?: string; nome: string; cargo: string; email?: string | null; cpf?: string | null; ativo?: boolean },
        { nome?: string; cargo?: string; email?: string | null; cpf?: string | null; ativo?: boolean }
      >;
      pedidos: TableDef<
        {
          id: string;
          cliente_id: string;
          vendedor_id: string;
          status: StatusPedido;
          perfil: TipoCliente;
          produtos: Produto[];
          plano: string;
          licencas_pagas: number;
          licencas_gratuitas: number;
          forma_pagamento: FormaPagamento;
          meio_pagamento: MeioPagamento;
          numero_parcelas: number | null;
          valor_mensal: number;
          valor_total: number;
          valor_licenca_adicional: number | null;
          valor_mensal_api: number | null;
          valor_mensal_software: number | null;
          primeiro_pagamento: string;
          dia_vencimento: number | null;
          convencao_parcelas: ConvencaoParcelas;
          vigencia_inicio: string;
          vigencia_fim: string;
          robusta: boolean;
          divulgacao: Divulgacao;
          percentual_desconto_divulgacao: number | null;
          post_divulgacao: string | null;
          api_modelo: ApiModelo | null;
          multa_tipo: MultaTipo;
          multa_texto: string;
          foro: string;
          condicao_especial: string | null;
          plano_legado_detectado: boolean;
          plano_legado_nome_original: string | null;
          geracao_contrato_erro: string | null;
          bling_pedido_id: string | null;
          sdr_id: string | null;
          closer_id: string | null;
          // 0039_pedidos_tipo_origem.sql
          tipo_venda: TipoVenda | null;
          origem: OrigemVenda | null;
          // 0040_pedidos_bling_sem_contrato.sql
          gera_contrato: boolean;
          emails_financeiro: string[];
          bling_pedido_numero: string | null;
          bling_enviado_em: string | null;
          bling_erro: string | null;
          criado_em: string;
          atualizado_em: string;
        },
        {
          id?: string;
          cliente_id: string;
          vendedor_id: string;
          status?: StatusPedido;
          perfil: TipoCliente;
          produtos?: Produto[];
          plano: string;
          licencas_pagas?: number;
          licencas_gratuitas?: number;
          forma_pagamento: FormaPagamento;
          meio_pagamento?: MeioPagamento;
          numero_parcelas?: number | null;
          valor_mensal: number;
          valor_total: number;
          valor_licenca_adicional?: number | null;
          valor_mensal_api?: number | null;
          valor_mensal_software?: number | null;
          primeiro_pagamento: string;
          dia_vencimento?: number | null;
          convencao_parcelas?: ConvencaoParcelas;
          vigencia_inicio: string;
          vigencia_fim: string;
          robusta?: boolean;
          divulgacao?: Divulgacao;
          percentual_desconto_divulgacao?: number | null;
          post_divulgacao?: string | null;
          api_modelo?: ApiModelo | null;
          multa_tipo?: MultaTipo;
          multa_texto: string;
          foro?: string;
          condicao_especial?: string | null;
          plano_legado_detectado?: boolean;
          plano_legado_nome_original?: string | null;
          geracao_contrato_erro?: string | null;
          bling_pedido_id?: string | null;
          sdr_id?: string | null;
          closer_id?: string | null;
          tipo_venda?: TipoVenda | null;
          origem?: OrigemVenda | null;
          gera_contrato?: boolean;
          emails_financeiro?: string[];
          bling_pedido_numero?: string | null;
          bling_enviado_em?: string | null;
          bling_erro?: string | null;
        },
        Partial<{
          cliente_id: string;
          vendedor_id: string;
          status: StatusPedido;
          perfil: TipoCliente;
          produtos: Produto[];
          plano: string;
          licencas_pagas: number;
          licencas_gratuitas: number;
          forma_pagamento: FormaPagamento;
          meio_pagamento: MeioPagamento;
          numero_parcelas: number | null;
          valor_mensal: number;
          valor_total: number;
          valor_licenca_adicional: number | null;
          valor_mensal_api: number | null;
          valor_mensal_software: number | null;
          primeiro_pagamento: string;
          dia_vencimento: number | null;
          convencao_parcelas: ConvencaoParcelas;
          vigencia_inicio: string;
          vigencia_fim: string;
          robusta: boolean;
          divulgacao: Divulgacao;
          percentual_desconto_divulgacao: number | null;
          post_divulgacao: string | null;
          api_modelo: ApiModelo | null;
          multa_tipo: MultaTipo;
          multa_texto: string;
          foro: string;
          condicao_especial: string | null;
          plano_legado_detectado: boolean;
          plano_legado_nome_original: string | null;
          geracao_contrato_erro: string | null;
          bling_pedido_id: string | null;
          sdr_id: string | null;
          closer_id: string | null;
          tipo_venda: TipoVenda | null;
          origem: OrigemVenda | null;
          gera_contrato: boolean;
          emails_financeiro: string[];
          bling_pedido_numero: string | null;
          bling_enviado_em: string | null;
          bling_erro: string | null;
        }>
      >;
      pedido_signatarios: TableDef<
        { id: string; pedido_id: string; signatario_cliente_id: string; tipo: TipoSignatario },
        { id?: string; pedido_id: string; signatario_cliente_id: string; tipo: TipoSignatario },
        never
      >;
      pedido_representantes_footure: TableDef<
        { id: string; pedido_id: string; representante_footure_id: string },
        { id?: string; pedido_id: string; representante_footure_id: string },
        never
      >;
      pedido_testemunhas_footure: TableDef<
        { id: string; pedido_id: string; nome_completo: string; email: string; cpf: string },
        { id?: string; pedido_id: string; nome_completo: string; email: string; cpf: string },
        never
      >;
      contratos: TableDef<
        {
          id: string;
          pedido_id: string;
          versao: number;
          arquivo_path: string;
          gerado_em: string;
          gerado_por: string;
          motivo_versao: string | null;
          status_revisao: StatusRevisaoContrato;
          clicksign_envelope_id: string | null;
          clicksign_document_id: string | null;
          arquivo_assinado_path: string | null;
          // 0028_contratos_assinatura_incompleta.sql
          assinatura_encerrada_em: string | null;
          assinatura_incompleta: boolean;
        },
        {
          id?: string;
          pedido_id: string;
          versao: number;
          arquivo_path: string;
          gerado_por: string;
          motivo_versao?: string | null;
          status_revisao?: StatusRevisaoContrato;
          clicksign_envelope_id?: string | null;
          clicksign_document_id?: string | null;
          arquivo_assinado_path?: string | null;
        },
        {
          status_revisao?: StatusRevisaoContrato;
          clicksign_envelope_id?: string | null;
          clicksign_document_id?: string | null;
          arquivo_assinado_path?: string | null;
          assinatura_encerrada_em?: string | null;
          assinatura_incompleta?: boolean;
        }
      >;
      // supabase/migrations/0031_bling_pedidos.sql
      bling_pedidos: TableDef<
        {
          id: number;
          contato_id: number;
          numero: string;
          data: string | null;
          total: number;
          situacao_id: number | null;
          situacao_valor: number | null;
          sincronizado_em: string;
        },
        {
          id: number;
          contato_id: number;
          numero: string;
          data?: string | null;
          total?: number;
          situacao_id?: number | null;
          situacao_valor?: number | null;
          sincronizado_em?: string;
        },
        Partial<{ numero: string; data: string | null; total: number; situacao_id: number | null; situacao_valor: number | null; sincronizado_em: string }>
      >;
      // supabase/migrations/0030_bling_parcelas.sql
      bling_parcelas: TableDef<
        {
          id: number;
          contato_id: number;
          numero_pedido_origem: string | null;
          vencimento: string;
          valor: number;
          situacao: number;
          sincronizado_em: string;
          // 0032_bling_parcelas_baixa.sql
          data_pagamento: string | null;
          valor_pago: number | null;
          situacao_detalhada: number | null;
        },
        {
          id: number;
          contato_id: number;
          numero_pedido_origem?: string | null;
          vencimento: string;
          valor: number;
          situacao: number;
          sincronizado_em?: string;
        },
        Partial<{
          numero_pedido_origem: string | null;
          vencimento: string;
          valor: number;
          situacao: number;
          sincronizado_em: string;
          data_pagamento: string | null;
          valor_pago: number | null;
          situacao_detalhada: number | null;
        }>
      >;
      // supabase/migrations/0047_marketing_base.sql
      mkt_contas: TableDef<
        { account_id: string; bu: BuMarketing; nome: string; ativa: boolean },
        { account_id: string; bu: BuMarketing; nome: string; ativa?: boolean },
        Partial<{ bu: BuMarketing; nome: string; ativa: boolean }>
      >;
      mkt_configuracao: TableDef<
        { id: boolean; kommo_campos: KommoCampos; limiares: LimiaresMarketing; janela_anuncio_dias: number; backfill_desde: string; atualizado_em: string },
        { id?: boolean; kommo_campos: KommoCampos; limiares: LimiaresMarketing; janela_anuncio_dias?: number; backfill_desde?: string; atualizado_em?: string },
        Partial<{ kommo_campos: KommoCampos; limiares: LimiaresMarketing; janela_anuncio_dias: number; backfill_desde: string; atualizado_em: string }>
      >;
      mkt_kommo_funis: TableDef<
        { pipeline_id: number; nome: string; bu: BuFunil; bu_manual: boolean; sincronizado_em: string },
        { pipeline_id: number; nome: string; bu: BuFunil; bu_manual?: boolean; sincronizado_em?: string },
        Partial<{ nome: string; bu: BuFunil; bu_manual: boolean; sincronizado_em: string }>
      >;
      mkt_kommo_etapas: TableDef<
        { pipeline_id: number; status_id: number; nome: string; sort: number; eh_mql: boolean },
        { pipeline_id: number; status_id: number; nome: string; sort?: number; eh_mql?: boolean },
        Partial<{ nome: string; sort: number; eh_mql: boolean }>
      >;
      mkt_kommo_leads: TableDef<LeadKommoRow, Omit<LeadKommoRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<LeadKommoRow>>;
      mkt_meta_campanha_dia: TableDef<MetaCampanhaDiaRow, Omit<MetaCampanhaDiaRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MetaCampanhaDiaRow>>;
      mkt_meta_anuncio_dia: TableDef<MetaAnuncioDiaRow, Omit<MetaAnuncioDiaRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MetaAnuncioDiaRow>>;
      // supabase/migrations/0048_marketing_criativos.sql
      mkt_meta_criativos: TableDef<
        { ad_id: string; account_id: string; creative_id: string | null; imagem_path: string | null; atualizado_em: string },
        { ad_id: string; account_id: string; creative_id?: string | null; imagem_path?: string | null; atualizado_em?: string },
        Partial<{ creative_id: string | null; imagem_path: string | null; atualizado_em: string }>
      >;
      // supabase/migrations/0049_marketing_sugestoes_ia.sql
      mkt_sugestoes_ia: TableDef<SugestaoIaRow, Omit<SugestaoIaRow, "id" | "criado_em"> & { id?: string; criado_em?: string }, Partial<SugestaoIaRow>>;
      mkt_sync_execucoes: TableDef<
        SyncExecucaoRow,
        Partial<SyncExecucaoRow> & { fonte: SyncExecucaoRow["fonte"]; tipo: SyncExecucaoRow["tipo"] },
        Partial<SyncExecucaoRow>
      >;
      // supabase/migrations/0046_academy_parcelas.sql
      academy_parcelas: TableDef<
        { id: number; bling_pedido_id: number; contato_id: number | null; vencimento: string; valor: number; situacao: number; sincronizado_em: string },
        { id: number; bling_pedido_id: number; contato_id?: number | null; vencimento: string; valor?: number; situacao: number; sincronizado_em?: string },
        Partial<{ bling_pedido_id: number; contato_id: number | null; vencimento: string; valor: number; situacao: number; sincronizado_em: string }>
      >;
      // supabase/migrations/0042_academy_vendas.sql
      academy_vendas: TableDef<
        {
          bling_pedido_id: number;
          numero: string;
          data: string | null;
          total: number;
          situacao_id: number | null;
          situacao_valor: number | null;
          contato_id: number | null;
          contato_nome: string | null;
          contato_documento: string | null;
          produto: string | null;
          categoria: CategoriaAcademy;
          sincronizado_em: string;
          // 0044
          total_produtos: number | null;
          desconto: number | null;
          cupom: string | null;
          numero_loja: string | null;
          pagamentos: PagamentoAcademy[] | null;
          detalhado_em: string | null;
          taxa_real: number | null;
          valor_recebido: number | null;
          baixa_em: string | null;
          baixa_consultada_em: string | null;
        },
        {
          bling_pedido_id: number;
          numero: string;
          data?: string | null;
          total?: number;
          situacao_id?: number | null;
          situacao_valor?: number | null;
          contato_id?: number | null;
          contato_nome?: string | null;
          contato_documento?: string | null;
          produto?: string | null;
          categoria: CategoriaAcademy;
          sincronizado_em?: string;
          total_produtos?: number | null;
          desconto?: number | null;
          cupom?: string | null;
          numero_loja?: string | null;
          pagamentos?: PagamentoAcademy[] | null;
          detalhado_em?: string | null;
          taxa_real?: number | null;
          valor_recebido?: number | null;
          baixa_em?: string | null;
          baixa_consultada_em?: string | null;
        },
        Partial<{
          numero: string;
          data: string | null;
          total: number;
          situacao_id: number | null;
          situacao_valor: number | null;
          contato_nome: string | null;
          produto: string | null;
          categoria: CategoriaAcademy;
          sincronizado_em: string;
          total_produtos: number | null;
          desconto: number | null;
          cupom: string | null;
          numero_loja: string | null;
          pagamentos: PagamentoAcademy[] | null;
          detalhado_em: string | null;
          taxa_real: number | null;
          valor_recebido: number | null;
          baixa_em: string | null;
          baixa_consultada_em: string | null;
        }>
      >;
      // supabase/migrations/0041_analise_versoes_contrato.sql
      contrato_analises: TableDef<
        { id: string; contrato_id: string; base_contrato_id: string | null; status: "pendente" | "concluida" | "erro"; resumo: string | null; resumo_ia: boolean; erro: string | null; criado_em: string },
        { id?: string; contrato_id: string; base_contrato_id?: string | null; status?: "pendente" | "concluida" | "erro"; resumo?: string | null; resumo_ia?: boolean; erro?: string | null },
        Partial<{ base_contrato_id: string | null; status: "pendente" | "concluida" | "erro"; resumo: string | null; resumo_ia: boolean; erro: string | null }>
      >;
      contrato_mudancas: TableDef<
        {
          id: string;
          analise_id: string;
          ordem: number;
          clausula: string | null;
          tipo: "alterado" | "incluido" | "removido";
          trecho_original: string;
          trecho_novo: string;
          resumo: string | null;
          sugestao: "modelo" | "especifico" | null;
          motivo_sugestao: string | null;
          decisao: "pendente" | "agregar" | "manter";
          decidido_por: string | null;
          decidido_em: string | null;
        },
        {
          id?: string;
          analise_id: string;
          ordem: number;
          clausula?: string | null;
          tipo: "alterado" | "incluido" | "removido";
          trecho_original?: string;
          trecho_novo?: string;
          resumo?: string | null;
          sugestao?: "modelo" | "especifico" | null;
          motivo_sugestao?: string | null;
        },
        Partial<{ resumo: string | null; sugestao: "modelo" | "especifico" | null; motivo_sugestao: string | null; decisao: "pendente" | "agregar" | "manter"; decidido_por: string | null; decidido_em: string | null }>
      >;
      modelo_contrato_ajustes: TableDef<
        {
          id: string;
          perfil: "clube" | "agente";
          trecho_original: string;
          trecho_novo: string;
          mudanca_id: string | null;
          ativo: boolean;
          criado_por: string | null;
          criado_em: string;
          desativado_por: string | null;
          desativado_em: string | null;
        },
        { id?: string; perfil: "clube" | "agente"; trecho_original: string; trecho_novo: string; mudanca_id?: string | null; criado_por?: string | null },
        Partial<{ ativo: boolean; desativado_por: string | null; desativado_em: string | null }>
      >;
      // supabase/migrations/0036_contrato_licencas_bling.sql
      contrato_licencas_bling: TableDef<
        {
          bling_pedido_id: number;
          licencas_pagas: number;
          licencas_gratuitas: number;
          valor_licenca_adicional: number | null;
          atualizado_por: string | null;
          atualizado_em: string;
        },
        {
          bling_pedido_id: number;
          licencas_pagas: number;
          licencas_gratuitas?: number;
          valor_licenca_adicional?: number | null;
          atualizado_por?: string | null;
          atualizado_em?: string;
        },
        Partial<{ licencas_pagas: number; licencas_gratuitas: number; valor_licenca_adicional: number | null; atualizado_por: string | null; atualizado_em: string }>
      >;
      // supabase/migrations/0035_contrato_equipe_bling.sql
      contrato_equipe_bling: TableDef<
        {
          bling_pedido_id: number;
          sdr_id: string | null;
          closer_id: string | null;
          // 0038_contrato_tipo_origem_bling.sql
          tipo_venda: TipoVenda | null;
          origem: OrigemVenda | null;
          atualizado_por: string | null;
          atualizado_em: string;
        },
        {
          bling_pedido_id: number;
          sdr_id?: string | null;
          closer_id?: string | null;
          tipo_venda?: TipoVenda | null;
          origem?: OrigemVenda | null;
          atualizado_por?: string | null;
          atualizado_em?: string;
        },
        Partial<{ sdr_id: string | null; closer_id: string | null; tipo_venda: TipoVenda | null; origem: OrigemVenda | null; atualizado_por: string | null; atualizado_em: string }>
      >;
      // supabase/migrations/0034_contrato_vigencia_bling.sql
      contrato_vigencia_bling: TableDef<
        { bling_pedido_id: number; vigencia_inicio: string; vigencia_fim: string; atualizado_por: string | null; atualizado_em: string },
        { bling_pedido_id: number; vigencia_inicio: string; vigencia_fim: string; atualizado_por?: string | null; atualizado_em?: string },
        Partial<{ vigencia_inicio: string; vigencia_fim: string; atualizado_por: string | null; atualizado_em: string }>
      >;
      // supabase/migrations/0033_contrato_arquivos_bling.sql
      contrato_arquivos_bling: TableDef<
        { id: string; bling_pedido_id: number; arquivo_path: string; nome_arquivo: string; tamanho_bytes: number | null; enviado_por: string | null; enviado_em: string },
        { id?: string; bling_pedido_id: number; arquivo_path: string; nome_arquivo: string; tamanho_bytes?: number | null; enviado_por?: string | null },
        never
      >;
      // supabase/migrations/0029_contrato_validacao.sql
      contrato_validacao: TableDef<
        { id: string; contrato_id: string; item: ItemValidacaoContrato; marcado_por: string | null; marcado_em: string },
        { id?: string; contrato_id: string; item: ItemValidacaoContrato; marcado_por?: string | null },
        never
      >;
      // supabase/migrations/0027_contrato_signatarios_clicksign.sql
      contrato_signatarios: TableDef<
        {
          id: string;
          contrato_id: string;
          clicksign_signer_id: string | null;
          nome: string;
          email: string;
          papel: PapelAssinaturaClicksign;
          lado: LadoSignatario;
          status: StatusAssinaturaSignatario;
          assinado_em: string | null;
          ordem: number;
          criado_em: string;
        },
        {
          id?: string;
          contrato_id: string;
          clicksign_signer_id?: string | null;
          nome: string;
          email: string;
          papel: PapelAssinaturaClicksign;
          lado: LadoSignatario;
          status?: StatusAssinaturaSignatario;
          assinado_em?: string | null;
          ordem?: number;
        },
        Partial<{ status: StatusAssinaturaSignatario; assinado_em: string | null; clicksign_signer_id: string | null }>
      >;
      transicoes: TableDef<
        {
          id: string;
          pedido_id: string;
          de: StatusPedido | null;
          para: StatusPedido;
          ator_id: string | null;
          comentario: string | null;
          criado_em: string;
        },
        {
          id?: string;
          pedido_id: string;
          de?: StatusPedido | null;
          para: StatusPedido;
          ator_id?: string | null;
          comentario?: string | null;
        },
        never
      >;
      regras_comissao: TableDef<
        {
          id: string;
          ativo: boolean;
          percentual: number;
          base_calculo: BaseCalculoComissao;
          escopo_tipo: EscopoComissao;
          escopo_valor: string | null;
          vigencia_inicio: string;
          criado_em: string;
        },
        {
          id?: string;
          ativo?: boolean;
          percentual: number;
          base_calculo?: BaseCalculoComissao;
          escopo_tipo?: EscopoComissao;
          escopo_valor?: string | null;
          vigencia_inicio?: string;
        },
        Partial<{
          ativo: boolean;
          percentual: number;
          base_calculo: BaseCalculoComissao;
          escopo_tipo: EscopoComissao;
          escopo_valor: string | null;
          vigencia_inicio: string;
        }>
      >;
      comissoes: TableDef<
        {
          id: string;
          pedido_id: string;
          vendedor_id: string;
          regra_id: string | null;
          base: number;
          percentual: number;
          valor_calculado: number;
          status: StatusComissao;
          pago_em: string | null;
          pago_observacao: string | null;
          criado_em: string;
        },
        {
          id?: string;
          pedido_id: string;
          vendedor_id: string;
          regra_id?: string | null;
          base: number;
          percentual: number;
          valor_calculado: number;
          status?: StatusComissao;
        },
        Partial<{ status: StatusComissao; pago_em: string | null; pago_observacao: string | null }>
      >;
      integracoes_bling: TableDef<
        {
          id: string;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          config: Record<string, unknown>;
          atualizado_em: string;
        },
        { id?: string; access_token?: string | null; refresh_token?: string | null; expires_at?: string | null; config?: Record<string, unknown> },
        Partial<{ access_token: string | null; refresh_token: string | null; expires_at: string | null; config: Record<string, unknown> }>
      >;
      integracoes_clicksign: TableDef<
        { id: string; access_token: string | null; config: Record<string, unknown>; atualizado_em: string },
        { id?: string; access_token?: string | null; config?: Record<string, unknown> },
        Partial<{ access_token: string | null; config: Record<string, unknown> }>
      >;
      configuracoes_comissionamento: TableDef<
        {
          id: true;
          percentual_imposto: number;
          percentual_comissao_total: number;
          percentual_comissao_sdr: number;
          percentual_comissao_closer: number;
          atualizado_por: string | null;
          atualizado_em: string;
        },
        never,
        Partial<{
          percentual_imposto: number;
          percentual_comissao_total: number;
          percentual_comissao_sdr: number;
          percentual_comissao_closer: number;
          atualizado_por: string | null;
        }>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      // supabase/migrations/0004_transicoes_rpc.sql
      registrar_transicao: {
        Args: { p_pedido_id: string; p_para: StatusPedido; p_comentario?: string | null };
        Returns: undefined;
      };
    };
  };
}

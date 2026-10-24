// Tipos escritos à mão a partir de supabase/migrations/0001_init.sql — não há
// projeto Supabase conectado ainda para rodar `supabase gen types`. Quando
// houver um projeto real, regenerar com:
//   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// e conferir se nada divergiu do que está aqui.

export type PapelUsuario = "vendedor" | "juridico" | "admin" | "marketing" | "financeiro";
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
  /** URL de entrada do primeiro toque (com as UTMs); descoberto pelo nome, como ftp_utm_campaign. */
  landing_page?: number | null;
  /** 0054: conjunto de anúncios e origem do lead (campos do formulário). */
  utm_adset_id?: number;
  utm_source?: number;
}
/** 0054: estágio padrão de uma etapa do Kommo (visão Funil). */
export type EstagioFunil = "entrada" | "tentativa" | "conectado" | "qualificado" | "oferta" | "negociacao" | "ganho" | "perdido";
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
  /** 0054 */
  loss_reason_id: number | null;
  responsavel_id: number | null;
  tags: string[] | null;
  adset_id: string | null;
  utm_source: string | null;
  sincronizado_em: string;
};
/** 0055: uma mensagem de WhatsApp/Instagram do lead (sem o conteúdo). */
export type MensagemKommoRow = {
  evento_id: string;
  lead_id: number;
  criado_em: string;
  entrada: boolean;
  autor_id: number | null;
  origem: string | null;
  talk_id: number | null;
  sincronizado_em: string;
};
/** 0055: resumo das conversas de um lead (mkt_resumo_conversas). */
export type ResumoConversaRow = {
  lead_id: number;
  primeira_saida_em: string | null;
  primeira_entrada_em: string | null;
  resposta_time_em: string | null;
  saidas_antes_resposta: number;
  saidas: number;
  entradas: number;
  ultima_mensagem_em: string | null;
};
/** 0054: uma mudança de etapa de um lead (evento lead_status_changed do Kommo). */
export type MovimentoKommoRow = {
  evento_id: string;
  lead_id: number;
  criado_em: string;
  pipeline_de: number | null;
  status_de: number | null;
  pipeline_para: number | null;
  status_para: number | null;
  autor_id: number | null;
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
  /** 0054: topo do funil (do actions_raw). */
  link_clicks: number;
  landing_page_views: number;
  checkouts: number;
  video_views: number;
  actions_raw: unknown;
  sincronizado_em: string;
};
export type MetaCampanhaDiaRow = MetaDiaBase & { campaign_id: string };
export type MetaAnuncioDiaRow = MetaDiaBase & { ad_id: string; adset_id: string | null; adset_name: string | null; ad_name: string | null };
export type VerificacaoRastreioRow = {
  id: string;
  campanha_chave: string;
  codigo: string;
  url_teste: string;
  esperado: unknown;
  status: "aguardando" | "ok" | "problema";
  resultado: unknown;
  lead_id: number | null;
  criado_por: string | null;
  criado_em: string;
  verificado_em: string | null;
};
export type SugestaoIaRow = {
  id: string;
  campanha_chave: string;
  campanha_nome: string;
  /** 0056: 'criativos' (aba Criativos) ou 'funil' (Estratégias por IA da aba Funil). */
  tipo: "criativos" | "funil";
  periodo: "30d" | "90d" | "tudo";
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
/** 0058: régua de cobrança do Footlink (F1). */
export type ModoCobranca = "desligado" | "aprovacao" | "automatico";
/** "cobranca" (0063): envio do boleto + Pix do Inter, na antecedência configurada (F2). */
export type TipoEnvioCobranca = "cobranca" | "lembrete" | "vencimento" | "atraso" | "escalonamento";
export type StatusEnvioCobranca = "pendente" | "enviado" | "erro" | "descartado" | "cancelado";
export type EntregaEnvioCobranca = "entregue" | "atrasada" | "devolvido" | "spam";
export type CobrancaConfiguracaoRow = {
  id: boolean;
  modo: ModoCobranca;
  regua_dias: number[];
  escalonamento_dias: number;
  data_corte: string | null;
  remetente_nome: string;
  remetente_email: string | null;
  responder_para: string[];
  emails_escalonamento: string[];
  chave_pix: string | null;
  email_teste: string | null;
  // 0062 · F2 (Banco Inter)
  inter_emissao_ativa: boolean;
  inter_antecedencia_dias: number;
  inter_multa_percentual: number | null;
  inter_juros_mensal_percentual: number | null;
  inter_dias_validade: number;
  inter_data_corte: string | null;
  bling_baixa_portador_id: number | null;
  bling_baixa_categoria_id: number | null;
  atualizado_em: string;
  atualizado_por: string | null;
};
export type CobrancaClienteRow = {
  contato_id: number;
  pausada: boolean;
  motivo_pausa: string | null;
  regua_dias: number[] | null;
  destinatarios_extra: string[];
  email_bling: string | null;
  email_nf_bling: string | null;
  emails_buscados_em: string | null;
  /** 0064: janela própria do envio da cobrança (boleto): antecedência em dias ou "até o dia X do mês". */
  cobranca_antecedencia_dias: number | null;
  cobranca_dia_mes: number | null;
  atualizado_em: string;
  atualizado_por: string | null;
};
export type CobrancaEnvioRow = {
  id: string;
  contato_id: number;
  tipo: TipoEnvioCobranca;
  data_prevista: string;
  status: StatusEnvioCobranca;
  destinatarios: string[];
  assunto: string | null;
  erro: string | null;
  resend_id: string | null;
  entrega: EntregaEnvioCobranca | null;
  entrega_detalhe: string | null;
  entrega_em: string | null;
  criado_em: string;
  decidido_por: string | null;
  decidido_em: string | null;
  enviado_em: string | null;
  /** 0059: gerado em modo de teste — apagado ao sair do teste. */
  teste: boolean;
};
/** 0062: cobrança do Banco Inter (boleto + Pix) ligada a uma parcela do Bling. */
export type CobrancaBoletoRow = {
  id: string;
  parcela_id: number;
  contato_id: number;
  bling_pedido_id: number | null;
  origem: "sistema" | "manual";
  codigo_solicitacao: string;
  seu_numero: string | null;
  valor: number;
  vencimento: string;
  situacao: string;
  nosso_numero: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  pix_copia_e_cola: string | null;
  txid: string | null;
  valor_recebido: number | null;
  recebido_em: string | null;
  origem_recebimento: string | null;
  baixa_bling_em: string | null;
  baixa_bling_erro: string | null;
  emitido_em: string;
  emitido_por: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  atualizado_em: string;
  teste: boolean;
};
export type CobrancaEnvioItemRow = {
  envio_id: string;
  parcela_id: number;
  /** 0060: pedido de venda da parcela (destinatários pelas observações internas). */
  bling_pedido_id: number | null;
  etapa: number;
  vencimento: string;
  valor: number;
  rotulo: string;
};

/** 0053: execuções da sincronização com o Bling (cron e botão da sidebar). */
export type BlingSyncExecucaoRow = {
  id: string;
  origem: "cron" | "manual";
  status: "rodando" | "ok" | "erro";
  resumo: Record<string, unknown> | null;
  erro: string | null;
  iniciado_em: string;
  terminado_em: string | null;
  disparado_por: string | null;
};

/** 0061: Controladoria (visão do CFO). */
export type CamadaContaFinanceira = "disponivel" | "liquidez" | "aplicacao" | "gateway" | "cartao" | "ignorar";
export type FinCategoriaRow = { id: number; id_pai: number | null; descricao: string; tipo: number | null; sincronizado_em: string };
export type FinContaFinanceiraRow = {
  id: number;
  descricao: string;
  camada: CamadaContaFinanceira;
  saldo_informado: number | null;
  saldo_informado_em: string | null;
  atualizado_por: string | null;
  atualizado_em: string | null;
  sincronizado_em: string;
  /** 0065: saldo inicial cadastrado na conta no Bling. */
  saldo_inicial: number | null;
};
/** 0065: movimento de Caixa e Bancos do Bling (/caixas). */
export type FinCaixaMovimentoRow = {
  id: number;
  data: string;
  debito_credito: "C" | "D" | "S";
  valor: number;
  situacao: string | null;
  conta_financeira_id: number | null;
  competencia: string | null;
  categoria_id: number | null;
  transferencia: boolean | null;
  tipo_lancamento: string | null;
  origem_tipo: string | null;
  origem_id: number | null;
  assinatura: string;
  assinatura_detalhe: string | null;
  detalhado_em: string | null;
  sincronizado_em: string;
};
export type FinLancamentoRow = {
  id: number;
  tipo: "pagar" | "receber";
  situacao: number;
  vencimento: string;
  valor: number;
  saldo: number | null;
  data_emissao: string | null;
  competencia: string | null;
  contato_id: number | null;
  contato_nome: string | null;
  forma_pagamento_id: number | null;
  conta_financeira_id: number | null;
  categoria_id: number | null;
  ocorrencia_tipo: number | null;
  origem_tipo: string | null;
  origem_numero: string | null;
  tem_cobranca: boolean | null;
  historico: string | null;
  assinatura: string;
  assinatura_detalhe: string | null;
  detalhado_em: string | null;
  sincronizado_em: string;
};
export type FinPremissasRow = {
  id: boolean;
  colchao_meses: number;
  runway_alerta_meses: number;
  dias_conciliacao: number;
  excedente_meses: number;
  despesa_subiu_pct: number;
  fornecedor_novo_valor: number;
  duplicidade_dias: number;
  receber_antigo_dias: number;
  cobranca_antecedencia_dias: number;
  resumo_diario_ativo: boolean;
  atualizado_em: string;
  atualizado_por: string | null;
  /** 0065: diferença constante entre a soma dos movimentos e o saldo do balancete. */
  saldo_abertura_ajuste: number;
  saldo_abertura_referencia: string | null;
};
export type GrupoAlerta = "caixa" | "pagamentos" | "recebiveis" | "integracao";
export type SeveridadeAlerta = "critico" | "atencao" | "info";
export type StatusAlerta = "novo" | "em_tratamento" | "adiado" | "encerrado" | "resolvido";
export type FinAlertaRow = {
  id: string;
  chave: string;
  regra: string;
  grupo: GrupoAlerta;
  severidade: SeveridadeAlerta;
  titulo: string;
  descricao: string;
  acao: string;
  href: string | null;
  valor: number | null;
  status: StatusAlerta;
  responsavel_id: string | null;
  adiado_ate: string | null;
  motivo: string | null;
  criado_em: string;
  atualizado_em: string;
  visto_em: string;
  resolvido_em: string | null;
};
export type TipoEventoAlerta = "criado" | "reaberto" | "atribuido" | "adiado" | "encerrado" | "reativado" | "resolvido";
export type FinAlertaEventoRow = { id: string; alerta_id: string; tipo: TipoEventoAlerta; detalhe: string | null; autor_id: string | null; criado_em: string };

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
        { pipeline_id: number; status_id: number; nome: string; sort: number; eh_mql: boolean; estagio: EstagioFunil | null; estagio_manual: boolean },
        { pipeline_id: number; status_id: number; nome: string; sort?: number; eh_mql?: boolean; estagio?: EstagioFunil | null; estagio_manual?: boolean },
        Partial<{ nome: string; sort: number; eh_mql: boolean; estagio: EstagioFunil | null; estagio_manual: boolean }>
      >;
      // supabase/migrations/0054_marketing_funil.sql
      mkt_kommo_motivos_perda: TableDef<{ id: number; nome: string; sort: number }, { id: number; nome: string; sort?: number }, Partial<{ nome: string; sort: number }>>;
      mkt_kommo_usuarios: TableDef<{ id: number; nome: string; ativo: boolean }, { id: number; nome: string; ativo?: boolean }, Partial<{ nome: string; ativo: boolean }>>;
      mkt_kommo_movimentos: TableDef<MovimentoKommoRow, Omit<MovimentoKommoRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MovimentoKommoRow>>;
      // supabase/migrations/0055_marketing_conversas.sql
      mkt_kommo_mensagens: TableDef<MensagemKommoRow, Omit<MensagemKommoRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MensagemKommoRow>>;
      mkt_kommo_leads: TableDef<LeadKommoRow, Omit<LeadKommoRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<LeadKommoRow>>;
      mkt_meta_campanha_dia: TableDef<MetaCampanhaDiaRow, Omit<MetaCampanhaDiaRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MetaCampanhaDiaRow>>;
      mkt_meta_anuncio_dia: TableDef<MetaAnuncioDiaRow, Omit<MetaAnuncioDiaRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<MetaAnuncioDiaRow>>;
      // supabase/migrations/0048_marketing_criativos.sql
      mkt_meta_criativos: TableDef<
        { ad_id: string; account_id: string; creative_id: string | null; imagem_path: string | null; urls_destino: string[] | null; url_tags: string | null; status_anuncio: string | null; atualizado_em: string },
        { ad_id: string; account_id: string; creative_id?: string | null; imagem_path?: string | null; urls_destino?: string[] | null; url_tags?: string | null; status_anuncio?: string | null; atualizado_em?: string },
        Partial<{ creative_id: string | null; imagem_path: string | null; urls_destino: string[] | null; url_tags: string | null; status_anuncio: string | null; atualizado_em: string }>
      >;
      // supabase/migrations/0049_marketing_sugestoes_ia.sql
      mkt_sugestoes_ia: TableDef<SugestaoIaRow, Omit<SugestaoIaRow, "id" | "criado_em" | "tipo"> & { id?: string; criado_em?: string; tipo?: SugestaoIaRow["tipo"] }, Partial<SugestaoIaRow>>;
      // supabase/migrations/0050_marketing_rastreio.sql
      mkt_verificacoes_rastreio: TableDef<VerificacaoRastreioRow, Omit<VerificacaoRastreioRow, "id" | "criado_em" | "status" | "resultado" | "lead_id" | "verificado_em"> & Partial<VerificacaoRastreioRow>, Partial<VerificacaoRastreioRow>>;
      mkt_sync_execucoes: TableDef<
        SyncExecucaoRow,
        Partial<SyncExecucaoRow> & { fonte: SyncExecucaoRow["fonte"]; tipo: SyncExecucaoRow["tipo"] },
        Partial<SyncExecucaoRow>
      >;
      // supabase/migrations/0053_bling_sync_execucoes.sql
      // supabase/migrations/0058_cobranca_regua.sql
      cobranca_configuracao: TableDef<CobrancaConfiguracaoRow, Partial<CobrancaConfiguracaoRow>, Partial<CobrancaConfiguracaoRow>>;
      cobranca_clientes: TableDef<CobrancaClienteRow, Partial<CobrancaClienteRow> & { contato_id: number }, Partial<CobrancaClienteRow>>;
      cobranca_envios: TableDef<
        CobrancaEnvioRow,
        Partial<CobrancaEnvioRow> & Pick<CobrancaEnvioRow, "contato_id" | "tipo" | "data_prevista">,
        Partial<CobrancaEnvioRow>
      >;
      cobranca_envio_itens: TableDef<CobrancaEnvioItemRow, CobrancaEnvioItemRow, Partial<CobrancaEnvioItemRow>>;
      // supabase/migrations/0062_cobranca_inter.sql
      cobranca_boletos: TableDef<
        CobrancaBoletoRow,
        Partial<CobrancaBoletoRow> & Pick<CobrancaBoletoRow, "parcela_id" | "contato_id" | "origem" | "codigo_solicitacao" | "valor" | "vencimento" | "situacao">,
        Partial<CobrancaBoletoRow>
      >;
      cobranca_inter_eventos: TableDef<
        { id: string; recebido_em: string; payload: unknown; processado: boolean; erro: string | null },
        { payload: unknown; processado?: boolean; erro?: string | null },
        Partial<{ processado: boolean; erro: string | null }>
      >;
      // supabase/migrations/0060_cobranca_emails_pedido.sql
      cobranca_pedidos_emails: TableDef<
        { bling_pedido_id: number; emails: string[]; buscados_em: string },
        { bling_pedido_id: number; emails?: string[]; buscados_em?: string },
        Partial<{ emails: string[]; buscados_em: string }>
      >;
      // supabase/migrations/0061_controladoria.sql
      fin_categorias: TableDef<FinCategoriaRow, Omit<FinCategoriaRow, "sincronizado_em"> & { sincronizado_em?: string }, Partial<FinCategoriaRow>>;
      fin_contas_financeiras: TableDef<
        FinContaFinanceiraRow,
        Partial<FinContaFinanceiraRow> & Pick<FinContaFinanceiraRow, "id" | "descricao">,
        Partial<FinContaFinanceiraRow>
      >;
      fin_formas_pagamento: TableDef<
        { id: number; descricao: string; tipo_pagamento: number | null; sincronizado_em: string },
        { id: number; descricao: string; tipo_pagamento?: number | null; sincronizado_em?: string },
        Partial<{ descricao: string; tipo_pagamento: number | null; sincronizado_em: string }>
      >;
      fin_contatos: TableDef<
        { id: number; nome: string; sincronizado_em: string },
        { id: number; nome: string; sincronizado_em?: string },
        Partial<{ nome: string; sincronizado_em: string }>
      >;
      fin_lancamentos: TableDef<
        FinLancamentoRow,
        Partial<FinLancamentoRow> & Pick<FinLancamentoRow, "id" | "tipo" | "situacao" | "vencimento" | "valor" | "assinatura">,
        Partial<FinLancamentoRow>
      >;
      fin_premissas: TableDef<FinPremissasRow, Partial<FinPremissasRow>, Partial<FinPremissasRow>>;
      // supabase/migrations/0065_controladoria_caixas.sql
      fin_caixa_movimentos: TableDef<
        FinCaixaMovimentoRow,
        Partial<FinCaixaMovimentoRow> & Pick<FinCaixaMovimentoRow, "id" | "data" | "debito_credito" | "valor" | "assinatura">,
        Partial<FinCaixaMovimentoRow>
      >;
      fin_alertas: TableDef<
        FinAlertaRow,
        Partial<FinAlertaRow> & Pick<FinAlertaRow, "chave" | "regra" | "grupo" | "severidade" | "titulo" | "descricao" | "acao">,
        Partial<FinAlertaRow>
      >;
      fin_alerta_eventos: TableDef<
        FinAlertaEventoRow,
        Partial<FinAlertaEventoRow> & Pick<FinAlertaEventoRow, "alerta_id" | "tipo">,
        Partial<FinAlertaEventoRow>
      >;
      fin_resumos_diarios: TableDef<
        { data: string; enviado_em: string; destinatarios: string[]; resend_id: string | null },
        { data: string; enviado_em?: string; destinatarios?: string[]; resend_id?: string | null },
        Partial<{ enviado_em: string; destinatarios: string[]; resend_id: string | null }>
      >;
      bling_sync_execucoes: TableDef<
        BlingSyncExecucaoRow,
        Partial<BlingSyncExecucaoRow> & { origem: BlingSyncExecucaoRow["origem"] },
        Partial<BlingSyncExecucaoRow>
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
      // supabase/migrations/0055_marketing_conversas.sql
      mkt_resumo_conversas: {
        Args: { de: string; ate: string };
        Returns: ResumoConversaRow[];
      };
    };
  };
}

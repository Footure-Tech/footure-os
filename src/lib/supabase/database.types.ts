// Tipos escritos à mão a partir de supabase/migrations/0001_init.sql — não há
// projeto Supabase conectado ainda para rodar `supabase gen types`. Quando
// houver um projeto real, regenerar com:
//   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// e conferir se nada divergiu do que está aqui.

export type PapelUsuario = "vendedor" | "juridico" | "admin";
export type TipoCliente = "clube" | "agente";
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
        }
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

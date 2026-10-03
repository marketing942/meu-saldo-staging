// Arquivo gerado por `npm run gen:types` (supabase gen types). Não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      aprendizado_categoria: {
        Row: {
          categoria_id: string
          created_at: string
          id: string
          termo: string
          tipo: Database['public']['Enums']['tipo_gasto']
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          id?: string
          termo: string
          tipo: Database['public']['Enums']['tipo_gasto']
          updated_at?: string
          user_id?: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          id?: string
          termo?: string
          tipo?: Database['public']['Enums']['tipo_gasto']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'aprendizado_categoria_do_usuario'
            columns: ['categoria_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      cartoes: {
        Row: {
          arquivado: boolean
          cor: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite_centavos: number
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivado?: boolean
          cor?: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          limite_centavos: number
          nome: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          arquivado?: boolean
          cor?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite_centavos?: number
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contas: {
        Row: {
          created_at: string
          id: string
          nome: string
          saldo_inicial_centavos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          saldo_inicial_centavos?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial_centavos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dividas: {
        Row: {
          ativa: boolean
          cartao_id: string | null
          conta_id: string | null
          created_at: string
          deleted_at: string | null
          dia_vencimento: number
          forma_pagamento: Database['public']['Enums']['forma_pagamento']
          id: string
          infinita: boolean
          mes_inicio_ref: string
          nome: string
          parcelas_ja_pagas: number
          tipo: Database['public']['Enums']['tipo_divida']
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor_parcela_centavos: number
        }
        Insert: {
          ativa?: boolean
          cartao_id?: string | null
          conta_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dia_vencimento: number
          forma_pagamento?: Database['public']['Enums']['forma_pagamento']
          id?: string
          infinita?: boolean
          mes_inicio_ref?: string
          nome: string
          parcelas_ja_pagas?: number
          tipo?: Database['public']['Enums']['tipo_divida']
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor_parcela_centavos: number
        }
        Update: {
          ativa?: boolean
          cartao_id?: string | null
          conta_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dia_vencimento?: number
          forma_pagamento?: Database['public']['Enums']['forma_pagamento']
          id?: string
          infinita?: boolean
          mes_inicio_ref?: string
          nome?: string
          parcelas_ja_pagas?: number
          tipo?: Database['public']['Enums']['tipo_divida']
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor_parcela_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'dividas_cartao_do_usuario'
            columns: ['cartao_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'dividas_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      dividas_pagamentos: {
        Row: {
          cartao_id: string | null
          conta_id: string | null
          created_at: string
          divida_id: string
          fatura_mes_ref: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento']
          id: string
          mes_ref: string
          pago_em: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          cartao_id?: string | null
          conta_id?: string | null
          created_at?: string
          divida_id: string
          fatura_mes_ref?: string | null
          forma_pagamento: Database['public']['Enums']['forma_pagamento']
          id?: string
          mes_ref: string
          pago_em?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          cartao_id?: string | null
          conta_id?: string | null
          created_at?: string
          divida_id?: string
          fatura_mes_ref?: string | null
          forma_pagamento?: Database['public']['Enums']['forma_pagamento']
          id?: string
          mes_ref?: string
          pago_em?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'dividas_pagamentos_cartao_do_usuario'
            columns: ['cartao_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'dividas_pagamentos_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'dividas_pagamentos_divida_do_usuario'
            columns: ['divida_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'dividas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      faturas_pagas: {
        Row: {
          cartao_id: string
          conta_id: string
          created_at: string
          id: string
          mes_ref: string
          pago_em: string
          user_id: string
        }
        Insert: {
          cartao_id: string
          conta_id: string
          created_at?: string
          id?: string
          mes_ref: string
          pago_em?: string
          user_id?: string
        }
        Update: {
          cartao_id?: string
          conta_id?: string
          created_at?: string
          id?: string
          mes_ref?: string
          pago_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'faturas_pagas_cartao_do_usuario'
            columns: ['cartao_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'faturas_pagas_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      gastos: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          conta_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          fatura_mes_ref: string | null
          grupo_parcelas: string | null
          id: string
          origem: Database['public']['Enums']['origem_gasto']
          parcela_atual: number
          tipo: Database['public']['Enums']['tipo_gasto']
          total_parcelas: number
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          conta_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          fatura_mes_ref?: string | null
          grupo_parcelas?: string | null
          id?: string
          origem: Database['public']['Enums']['origem_gasto']
          parcela_atual?: number
          tipo: Database['public']['Enums']['tipo_gasto']
          total_parcelas?: number
          updated_at?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          conta_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          fatura_mes_ref?: string | null
          grupo_parcelas?: string | null
          id?: string
          origem?: Database['public']['Enums']['origem_gasto']
          parcela_atual?: number
          tipo?: Database['public']['Enums']['tipo_gasto']
          total_parcelas?: number
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'gastos_cartao_do_usuario'
            columns: ['cartao_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'gastos_categoria_do_usuario'
            columns: ['categoria_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'gastos_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      metas_receita: {
        Row: {
          created_at: string
          id: string
          mes_ref: string
          updated_at: string
          user_id: string
          valor_meta_centavos: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ref: string
          updated_at?: string
          user_id?: string
          valor_meta_centavos: number
        }
        Update: {
          created_at?: string
          id?: string
          mes_ref?: string
          updated_at?: string
          user_id?: string
          valor_meta_centavos?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          lembrete_diario: boolean
          mes_selecionado: string | null
          meta_desnecessario_centavos: number | null
          nome: string
          ocultar_valores: boolean
          onboarding_concluido: boolean
          tema: Database['public']['Enums']['tema_preferencia']
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          lembrete_diario?: boolean
          mes_selecionado?: string | null
          meta_desnecessario_centavos?: number | null
          nome?: string
          ocultar_valores?: boolean
          onboarding_concluido?: boolean
          tema?: Database['public']['Enums']['tema_preferencia']
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lembrete_diario?: boolean
          mes_selecionado?: string | null
          meta_desnecessario_centavos?: number | null
          nome?: string
          ocultar_valores?: boolean
          onboarding_concluido?: boolean
          tema?: Database['public']['Enums']['tema_preferencia']
          updated_at?: string
        }
        Relationships: []
      }
      projeto_gastos: {
        Row: {
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          id: string
          projeto_id: string
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          id?: string
          projeto_id: string
          updated_at?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          id?: string
          projeto_id?: string
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'projeto_gastos_projeto_do_usuario'
            columns: ['projeto_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'projetos'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      projetos: {
        Row: {
          arquivado: boolean
          conta_id: string | null
          created_at: string
          deleted_at: string | null
          descontar_do_saldo: boolean
          id: string
          nome: string
          orcamento_centavos: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivado?: boolean
          conta_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descontar_do_saldo?: boolean
          id?: string
          nome: string
          orcamento_centavos?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          arquivado?: boolean
          conta_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descontar_do_saldo?: boolean
          id?: string
          nome?: string
          orcamento_centavos?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projetos_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      receitas: {
        Row: {
          conta_id: string
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          id: string
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          conta_id: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          id?: string
          updated_at?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          conta_id?: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          id?: string
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'receitas_conta_do_usuario'
            columns: ['conta_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'contas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      data_no_mes: { Args: { p_dia: number; p_mes: string }; Returns: string }
      dias_no_mes: { Args: { p_mes: string }; Returns: number }
      dividas_do_mes: {
        Args: { p_mes_ref: string }
        Returns: {
          cartao_id: string
          conta_id: string
          data_vencimento: string
          dia_vencimento: number
          dias_para_vencer: number
          divida_id: string
          forma_pagamento: Database['public']['Enums']['forma_pagamento']
          infinita: boolean
          nome: string
          paga_antes_do_cadastro: boolean
          pagamento_id: string
          pago_em: string
          parcela_numero: number
          parcelas_restantes: number
          saldo_devedor_centavos: number
          status: Database['public']['Enums']['status_divida']
          tipo: Database['public']['Enums']['tipo_divida']
          total_parcelas: number
          valor_centavos: number
        }[]
      }
      fatura_cartao: {
        Args: { p_cartao_id: string; p_mes_ref: string }
        Returns: {
          arquivado: boolean
          cartao_id: string
          compras_centavos: number
          conta_pagamento_id: string
          cor: string
          data_fechamento: string
          data_vencimento: string
          dias_para_vencer: number
          dividas_centavos: number
          limite_centavos: number
          limite_disponivel_centavos: number
          limite_percentual: number
          limite_usado_centavos: number
          mes_ref: string
          nome: string
          pago_em: string
          qtd_compras: number
          status: Database['public']['Enums']['status_fatura']
          total_centavos: number
        }[]
      }
      faturas_do_mes: {
        Args: { p_cartao_id?: string; p_mes_ref: string }
        Returns: {
          arquivado: boolean
          cartao_id: string
          compras_centavos: number
          conta_pagamento_id: string
          cor: string
          data_fechamento: string
          data_vencimento: string
          dias_para_vencer: number
          dividas_centavos: number
          limite_centavos: number
          limite_disponivel_centavos: number
          limite_percentual: number
          limite_usado_centavos: number
          mes_ref: string
          nome: string
          pago_em: string
          qtd_compras: number
          status: Database['public']['Enums']['status_fatura']
          total_centavos: number
        }[]
      }
      fechamento_fatura: { Args: { p_dia_fechamento: number; p_mes: string }; Returns: string }
      gerar_parcelas: {
        Args: { p_data: string; p_total_parcelas: number; p_valor_total_centavos: number }
        Returns: {
          data: string
          parcela: number
          valor_centavos: number
        }[]
      }
      hoje: { Args: Record<PropertyKey, never>; Returns: string }
      mes_add: { Args: { p_mes: string; p_n: number }; Returns: string }
      mes_atual: { Args: Record<PropertyKey, never>; Returns: string }
      mes_de: { Args: { p_data: string }; Returns: string }
      mes_diff: { Args: { p_ate: string; p_de: string }; Returns: number }
      mes_fatura: { Args: { p_data: string; p_dia_fechamento: number }; Returns: string }
      numero_parcela_divida: {
        Args: { p_mes_inicio_ref: string; p_mes_ref: string; p_parcelas_ja_pagas: number }
        Returns: number
      }
      primeiro_dia: { Args: { p_mes: string }; Returns: string }
      progresso_meta_receita: {
        Args: { p_mes_ref: string }
        Returns: {
          batida: boolean
          dias_restantes: number
          falta_centavos: number
          mes_ref: string
          meta_centavos: number
          meta_mes_anterior_centavos: number
          percentual: number
          por_dia_centavos: number
          recebido_centavos: number
        }[]
      }
      resumo_mes: {
        Args: { p_mes_ref: string }
        Returns: {
          data_referencia: string
          desnecessario_centavos: number
          desnecessario_dias_para_estourar: number
          desnecessario_percentual: number
          desnecessario_projecao_centavos: number
          dias_no_mes: number
          dias_passados: number
          dias_restantes: number
          dividas_pagas_centavos: number
          dividas_pendentes_centavos: number
          dividas_total_centavos: number
          faturas_pendentes_centavos: number
          gastos_mes_centavos: number
          lancou_hoje: boolean
          mes_ref: string
          meta_desnecessario_centavos: number
          necessario_centavos: number
          pode_gastar_dia_centavos: number
          receitas_mes_centavos: number
          recorrentes_mensal_centavos: number
          saldo_devedor_centavos: number
          saldo_total_centavos: number
          situacao: Database['public']['Enums']['situacao_mes']
          sobra_mes_centavos: number
        }[]
      }
      saldo_contas: {
        Args: { p_ate?: string }
        Returns: {
          conta_id: string
          nome: string
          saldo_centavos: number
          saldo_inicial_centavos: number
        }[]
      }
      saldo_total: { Args: { p_ate?: string }; Returns: number }
      totais_projeto: {
        Args: { p_projeto_id: string }
        Returns: {
          arquivado: boolean
          descontar_do_saldo: boolean
          excedente_centavos: number
          nome: string
          orcamento_centavos: number
          percentual: number
          projeto_id: string
          qtd_gastos: number
          restante_centavos: number
          total_centavos: number
        }[]
      }
      total_fatura: { Args: { p_cartao_id: string; p_mes_ref: string }; Returns: number }
      ultimo_dia: { Args: { p_mes: string }; Returns: string }
      vencimento_fatura: {
        Args: { p_dia_fechamento: number; p_dia_vencimento: number; p_mes: string }
        Returns: string
      }
    }
    Enums: {
      forma_pagamento: 'conta' | 'cartao'
      origem_gasto: 'cartao' | 'pix' | 'dinheiro'
      situacao_mes: 'passado' | 'atual' | 'futuro'
      status_divida: 'paga' | 'pendente' | 'atrasada'
      status_fatura: 'aberta' | 'fechada' | 'paga'
      tema_preferencia: 'sistema' | 'claro' | 'escuro'
      tipo_divida:
        'financiamento' | 'emprestimo' | 'assinatura' | 'aluguel' | 'condominio' | 'outro'
      tipo_gasto: 'necessario' | 'desnecessario'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      forma_pagamento: ['conta', 'cartao'],
      origem_gasto: ['cartao', 'pix', 'dinheiro'],
      situacao_mes: ['passado', 'atual', 'futuro'],
      status_divida: ['paga', 'pendente', 'atrasada'],
      status_fatura: ['aberta', 'fechada', 'paga'],
      tema_preferencia: ['sistema', 'claro', 'escuro'],
      tipo_divida: ['financiamento', 'emprestimo', 'assinatura', 'aluguel', 'condominio', 'outro'],
      tipo_gasto: ['necessario', 'desnecessario'],
    },
  },
} as const

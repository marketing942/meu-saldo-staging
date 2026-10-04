import { useMutation, useQuery } from '@tanstack/react-query'

import { type MesRef, hoje } from '../datas'
import type { DividaParaCalculo } from '../regras/dividas'
import { useUsuario } from '../sessao'
import { type Enums, type Funcoes, type Linha, supabase } from '../supabase'
import { type Anulavel, agoraISO, dados, useAtualizarTudo } from './comum'

export type DividaDoMes = Anulavel<
  Funcoes['dividas_do_mes']['Returns'][number],
  | 'conta_id'
  | 'cartao_id'
  | 'total_parcelas'
  | 'parcelas_restantes'
  | 'pagamento_id'
  | 'pago_em'
  | 'saldo_devedor_centavos'
>

export type Divida = Linha<'dividas'>

export function useDividasDoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['dividas', id, mes],
    queryFn: () => dados<DividaDoMes[]>(supabase.rpc('dividas_do_mes', { p_mes_ref: mes })),
  })
}

export function useDivida(dividaId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['divida', id, dividaId],
    enabled: Boolean(dividaId),
    queryFn: () =>
      dados<Divida | null>(
        supabase
          .from('dividas')
          .select('*')
          .eq('user_id', id)
          .eq('id', dividaId ?? '')
          .is('deleted_at', null)
          .maybeSingle(),
      ),
  })
}

/**
 * Meses (mes_ref) com parcela marcada como paga. Usado na prévia do limite do
 * cartão ao editar uma conta a pagar (cada parcela paga libera o limite).
 */
export function usePagamentosDivida(dividaId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['divida-pagamentos', id, dividaId],
    enabled: Boolean(dividaId),
    queryFn: () =>
      dados<{ mes_ref: string }[]>(
        supabase
          .from('dividas_pagamentos')
          .select('mes_ref')
          .eq('user_id', id)
          .eq('divida_id', dividaId ?? ''),
      ),
  })
}

/** Linha da tabela no formato das regras puras (src/lib/regras/dividas). */
export function dividaParaCalculo(d: Divida): DividaParaCalculo {
  return {
    infinita: d.infinita,
    totalParcelas: d.total_parcelas,
    parcelasJaPagas: d.parcelas_ja_pagas,
    mesInicioRef: d.mes_inicio_ref,
    diaVencimento: d.dia_vencimento,
    valorParcelaCentavos: d.valor_parcela_centavos,
    ativa: d.ativa,
  }
}

export interface DadosDivida {
  nome: string
  tipo: Enums['tipo_divida']
  valor_parcela_centavos: number
  dia_vencimento: number
  infinita: boolean
  total_parcelas: number | null
  parcelas_ja_pagas: number
  forma_pagamento: Enums['forma_pagamento']
  conta_id: string | null
  cartao_id: string | null
  ativa: boolean
}

export function useSalvarDivida() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...divida }: DadosDivida & { id?: string }) => {
      const linha = {
        ...divida,
        // Recorrente não tem total nem "já pagas" (constraint do banco).
        total_parcelas: divida.infinita ? null : divida.total_parcelas,
        parcelas_ja_pagas: divida.infinita ? 0 : divida.parcelas_ja_pagas,
        conta_id: divida.forma_pagamento === 'conta' ? divida.conta_id : null,
        cartao_id: divida.forma_pagamento === 'cartao' ? divida.cartao_id : null,
      }
      if (id) await dados(supabase.from('dividas').update(linha).eq('id', id).eq('user_id', uid))
      else await dados(supabase.from('dividas').insert({ ...linha, user_id: uid }))
    },
    onSuccess: atualizar,
  })
}

/** Exclusão lógica: some de todos os meses, mas pode ser desfeita. */
export function useExcluirDivida() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(
        supabase.from('dividas').update({ deleted_at: agoraISO() }).eq('id', id).eq('user_id', uid),
      )
    },
    onSuccess: atualizar,
  })
}

/** Para o "Desfazer" (ver desfazerCom). */
export function restaurarDivida(uid: string, id: string) {
  return supabase.from('dividas').update({ deleted_at: null }).eq('id', id).eq('user_id', uid)
}

/**
 * Marca a parcela do mês como paga. Valor, forma de pagamento, conta/cartão e
 * fatura são preenchidos pelo gatilho dividas_pagamentos_preparar (retrato da
 * dívida); os valores enviados aqui só satisfazem o formato da tabela.
 */
export function usePagarDivida() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ divida, mes }: { divida: DividaDoMes; mes: MesRef }) => {
      await dados(
        supabase.from('dividas_pagamentos').insert({
          user_id: uid,
          divida_id: divida.divida_id,
          mes_ref: mes,
          pago_em: hoje(),
          valor_centavos: divida.valor_centavos,
          forma_pagamento: divida.forma_pagamento,
          conta_id: divida.conta_id,
          cartao_id: divida.cartao_id,
        }),
      )
    },
    onSuccess: atualizar,
  })
}

export function useDesfazerPagamentoDivida() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (pagamentoId: string) => {
      await dados(
        supabase.from('dividas_pagamentos').delete().eq('id', pagamentoId).eq('user_id', uid),
      )
    },
    onSuccess: atualizar,
  })
}

export const ROTULO_TIPO_DIVIDA: Record<Enums['tipo_divida'], string> = {
  financiamento: 'Financiamento',
  emprestimo: 'Empréstimo',
  assinatura: 'Assinatura',
  aluguel: 'Aluguel',
  condominio: 'Condomínio',
  outro: 'Outro',
}

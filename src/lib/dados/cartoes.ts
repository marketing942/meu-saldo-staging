import { useMutation, useQuery } from '@tanstack/react-query'

import { type DataISO, type MesRef, hoje } from '../datas'
import { useUsuario } from '../sessao'
import { type Funcoes, type Linha, supabase } from '../supabase'
import { type Anulavel, dados, useAtualizarTudo } from './comum'

export type Cartao = Pick<
  Linha<'cartoes'>,
  'id' | 'nome' | 'cor' | 'limite_centavos' | 'dia_fechamento' | 'dia_vencimento' | 'arquivado'
>

export type Fatura = Anulavel<
  Funcoes['faturas_do_mes']['Returns'][number],
  'pago_em' | 'conta_pagamento_id'
>

export type LimiteCartao = Funcoes['limite_cartao']['Returns'][number]

export function useCartoes() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['cartoes', id],
    queryFn: () =>
      dados<Cartao[]>(
        supabase
          .from('cartoes')
          .select('id, nome, cor, limite_centavos, dia_fechamento, dia_vencimento, arquivado')
          .eq('user_id', id)
          .order('created_at'),
      ),
  })
}

/** Uma fatura por cartão ativo: a que fecha no mês informado. */
export function useFaturasDoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['faturas', id, mes],
    queryFn: () => dados<Fatura[]>(supabase.rpc('faturas_do_mes', { p_mes_ref: mes })),
  })
}

export function useFatura(cartaoId: string, mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['fatura', id, cartaoId, mes],
    queryFn: async () => {
      const linhas = await dados<Fatura[]>(
        supabase.rpc('fatura_cartao', { p_cartao_id: cartaoId, p_mes_ref: mes }),
      )
      return linhas[0] ?? null
    },
  })
}

/**
 * Limite total, usado e disponível do cartão, calculados pelo banco a cada
 * consulta (public.limite_cartao). Toda gravação invalida as consultas, então
 * lançar, editar, excluir, desfazer ou pagar a fatura atualiza o limite na hora.
 */
export function useLimiteCartao(cartaoId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['limite-cartao', id, cartaoId],
    enabled: Boolean(cartaoId),
    queryFn: async () => {
      const linhas = await dados<LimiteCartao[]>(
        supabase.rpc('limite_cartao', { p_cartao_id: cartaoId ?? '' }),
      )
      return linhas[0] ?? null
    },
  })
}

export interface LancamentoFatura {
  id: string
  tipo: 'compra' | 'divida'
  descricao: string
  data: DataISO
  valor_centavos: number
  parcela_atual: number
  total_parcelas: number
}

/** Compras e contas a pagar pagas no cartão que entraram na fatura do mês. */
export function useLancamentosFatura(cartaoId: string, mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['fatura-lancamentos', id, cartaoId, mes],
    queryFn: async (): Promise<LancamentoFatura[]> => {
      const [compras, pagamentos] = await Promise.all([
        dados(
          supabase
            .from('gastos')
            .select('id, descricao, data, valor_centavos, parcela_atual, total_parcelas')
            .eq('user_id', id)
            .eq('cartao_id', cartaoId)
            .eq('fatura_mes_ref', mes)
            .is('deleted_at', null)
            .order('data', { ascending: false }),
        ),
        dados(
          supabase
            .from('dividas_pagamentos')
            .select('id, divida_id, pago_em, valor_centavos')
            .eq('user_id', id)
            .eq('cartao_id', cartaoId)
            .eq('fatura_mes_ref', mes),
        ),
      ])
      const nomes = new Map<string, string>()
      if (pagamentos.length > 0) {
        const dividas = await dados(
          supabase
            .from('dividas')
            .select('id, nome, deleted_at')
            .in(
              'id',
              pagamentos.map((p) => p.divida_id),
            ),
        )
        for (const d of dividas) if (!d.deleted_at) nomes.set(d.id, d.nome)
      }
      return [
        ...compras.map((c) => ({ ...c, tipo: 'compra' as const })),
        ...pagamentos
          .filter((p) => nomes.has(p.divida_id))
          .map((p) => ({
            id: p.id,
            tipo: 'divida' as const,
            descricao: nomes.get(p.divida_id) ?? 'Conta a pagar',
            data: p.pago_em,
            valor_centavos: p.valor_centavos,
            parcela_atual: 1,
            total_parcelas: 1,
          })),
      ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
    },
  })
}

export type DadosCartao = Omit<Cartao, 'id' | 'arquivado'>

export function useSalvarCartao() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...cartao }: DadosCartao & { id?: string }) => {
      if (id) await dados(supabase.from('cartoes').update(cartao).eq('id', id).eq('user_id', uid))
      else await dados(supabase.from('cartoes').insert({ ...cartao, user_id: uid }))
    },
    onSuccess: atualizar,
  })
}

export function useArquivarCartao() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, arquivado }: { id: string; arquivado: boolean }) => {
      await dados(supabase.from('cartoes').update({ arquivado }).eq('id', id).eq('user_id', uid))
    },
    onSuccess: atualizar,
  })
}

/** Cartão com compras não pode ser apagado (o banco recusa); arquive em vez disso. */
export function useExcluirCartao() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(supabase.from('cartoes').delete().eq('id', id).eq('user_id', uid))
    },
    onSuccess: atualizar,
  })
}

export function usePagarFatura() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (p: { cartaoId: string; mes: MesRef; contaId: string; pagoEm?: DataISO }) => {
      await dados(
        supabase.from('faturas_pagas').insert({
          user_id: uid,
          cartao_id: p.cartaoId,
          mes_ref: p.mes,
          conta_id: p.contaId,
          pago_em: p.pagoEm ?? hoje(),
        }),
      )
    },
    onSuccess: atualizar,
  })
}

export function useDesfazerPagamentoFatura() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (p: { cartaoId: string; mes: MesRef }) => {
      await dados(
        supabase
          .from('faturas_pagas')
          .delete()
          .eq('user_id', uid)
          .eq('cartao_id', p.cartaoId)
          .eq('mes_ref', p.mes),
      )
    },
    onSuccess: atualizar,
  })
}

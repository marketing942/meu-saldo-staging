import { useMutation, useQuery } from '@tanstack/react-query'

import { useUsuario } from '../sessao'
import { supabase } from '../supabase'
import { dados, useAtualizarTudo } from './comum'

/** Contas com saldo atual, na ordem de criação (a Carteira padrão vem primeiro). */
export function useContas() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['contas', id],
    queryFn: () => dados(supabase.rpc('saldo_contas', {})),
  })
}

/** Conta sugerida para dinheiro/Pix e receitas: a "Carteira" padrão, senão a primeira. */
export function contaPadrao<T extends { conta_id: string; nome: string }>(
  contas: readonly T[],
): T | undefined {
  return contas.find((c) => c.nome.trim().toLowerCase() === 'carteira') ?? contas[0]
}

export interface DadosConta {
  nome: string
  saldo_inicial_centavos: number
}

export function useSalvarConta() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...conta }: DadosConta & { id?: string }) => {
      if (id) await dados(supabase.from('contas').update(conta).eq('id', id).eq('user_id', uid))
      else await dados(supabase.from('contas').insert({ ...conta, user_id: uid }))
    },
    onSuccess: atualizar,
  })
}

/** Só apaga conta sem lançamentos; com lançamentos o banco recusa (23503). */
export function useExcluirConta() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(supabase.from('contas').delete().eq('id', id).eq('user_id', uid))
    },
    onSuccess: atualizar,
  })
}

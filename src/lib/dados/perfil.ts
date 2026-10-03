import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useUsuario } from '../sessao'
import { type AlteracaoLinha, type Linha, supabase } from '../supabase'
import { dados } from './comum'

export type Perfil = Linha<'profiles'>

export function usePerfil() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['perfil', id],
    queryFn: () =>
      dados<Perfil | null>(supabase.from('profiles').select('*').eq('id', id).maybeSingle()),
    staleTime: 5 * 60_000,
  })
}

/** Atualiza o perfil do usuário logado (otimista: a tela muda antes da resposta). */
export function useAtualizarPerfil() {
  const { id } = useUsuario()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (alteracao: AlteracaoLinha<'profiles'>) => {
      await dados(supabase.from('profiles').update(alteracao).eq('id', id))
    },
    onMutate: (alteracao) => {
      const anterior = cliente.getQueryData<Perfil | null>(['perfil', id])
      if (anterior) cliente.setQueryData(['perfil', id], { ...anterior, ...alteracao })
      return { anterior }
    },
    onError: (_erro, _alteracao, contexto) => {
      if (contexto?.anterior) cliente.setQueryData(['perfil', id], contexto.anterior)
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: ['perfil', id] }),
  })
}

/** Primeiro nome, para o "Olá". */
export function primeiroNome(perfil: Perfil | null | undefined): string {
  return perfil?.nome.trim().split(/\s+/)[0] ?? ''
}

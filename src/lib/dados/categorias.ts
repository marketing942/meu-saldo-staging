import { useMutation, useQuery } from '@tanstack/react-query'

import { useUsuario } from '../sessao'
import { supabase } from '../supabase'
import { dados, useAtualizarTudo } from './comum'

export interface Categoria {
  id: string
  nome: string
  cor: string
}

export function useCategorias() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['categorias', id],
    queryFn: () =>
      dados<Categoria[]>(
        supabase.from('categorias').select('id, nome, cor').eq('user_id', id).order('nome'),
      ),
    staleTime: 5 * 60_000,
  })
}

export function useSalvarCategoria() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...categoria }: Omit<Categoria, 'id'> & { id?: string }) => {
      if (id) {
        await dados(supabase.from('categorias').update(categoria).eq('id', id).eq('user_id', uid))
      } else {
        await dados(supabase.from('categorias').insert({ ...categoria, user_id: uid }))
      }
    },
    onSuccess: atualizar,
  })
}

/** Gastos da categoria ficam "sem categoria" (on delete set null no banco). */
export function useExcluirCategoria() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(supabase.from('categorias').delete().eq('id', id).eq('user_id', uid))
    },
    onSuccess: atualizar,
  })
}

/** Paleta das categorias e cartões (cores aceitas pelo banco: #RRGGBB). */
export const CORES = [
  { valor: '#3C8D6A', nome: 'Verde' },
  { valor: '#2E4A7A', nome: 'Azul-marinho' },
  { valor: '#4F7CAC', nome: 'Azul' },
  { valor: '#3F8F8F', nome: 'Verde-azulado' },
  { valor: '#C98F2E', nome: 'Mostarda' },
  { valor: '#A9762F', nome: 'Caramelo' },
  { valor: '#8A6A3F', nome: 'Marrom' },
  { valor: '#C65468', nome: 'Rosa' },
  { valor: '#6F5AA8', nome: 'Roxo' },
  { valor: '#5E5496', nome: 'Violeta' },
  { valor: '#6B7280', nome: 'Cinza' },
  { valor: '#1B2230', nome: 'Grafite' },
] as const

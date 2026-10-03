import { useMutation, useQuery } from '@tanstack/react-query'

import { type DataISO, type MesRef, primeiroDia, ultimoDia } from '../datas'
import { useUsuario } from '../sessao'
import { type Linha, supabase } from '../supabase'
import { agoraISO, dados, useAtualizarTudo } from './comum'

export type Receita = Pick<
  Linha<'receitas'>,
  'id' | 'descricao' | 'valor_centavos' | 'data' | 'conta_id'
>

const CAMPOS = 'id, descricao, valor_centavos, data, conta_id'

export function useReceitasRecentes(limite = 20) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['receitas', id, 'recentes', limite],
    queryFn: () =>
      dados<Receita[]>(
        supabase
          .from('receitas')
          .select(CAMPOS)
          .eq('user_id', id)
          .is('deleted_at', null)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limite),
      ),
  })
}

export function useReceitasDoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['receitas', id, 'mes', mes],
    queryFn: () =>
      dados<Receita[]>(
        supabase
          .from('receitas')
          .select(CAMPOS)
          .eq('user_id', id)
          .is('deleted_at', null)
          .gte('data', primeiroDia(mes))
          .lte('data', ultimoDia(mes))
          .order('data', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useReceita(receitaId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['receita', id, receitaId],
    enabled: Boolean(receitaId),
    queryFn: () =>
      dados<Receita | null>(
        supabase
          .from('receitas')
          .select(CAMPOS)
          .eq('user_id', id)
          .eq('id', receitaId ?? '')
          .is('deleted_at', null)
          .maybeSingle(),
      ),
  })
}

export interface DadosReceita {
  descricao: string
  valor_centavos: number
  data: DataISO
  conta_id: string
}

export function useSalvarReceita() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...receita }: DadosReceita & { id?: string }) => {
      if (id) await dados(supabase.from('receitas').update(receita).eq('id', id).eq('user_id', uid))
      else await dados(supabase.from('receitas').insert({ ...receita, user_id: uid }))
    },
    onSuccess: atualizar,
  })
}

export function useExcluirReceita() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(
        supabase
          .from('receitas')
          .update({ deleted_at: agoraISO() })
          .eq('id', id)
          .eq('user_id', uid),
      )
    },
    onSuccess: atualizar,
  })
}

/** Para o "Desfazer" (ver desfazerCom). */
export function restaurarReceita(uid: string, id: string) {
  return supabase.from('receitas').update({ deleted_at: null }).eq('id', id).eq('user_id', uid)
}

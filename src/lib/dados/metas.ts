import { useMutation, useQuery } from '@tanstack/react-query'

import type { MesRef } from '../datas'
import { useUsuario } from '../sessao'
import { type Funcoes, supabase } from '../supabase'
import { type Anulavel, dados, useAtualizarTudo } from './comum'

export type ProgressoMeta = Anulavel<
  Funcoes['progresso_meta_receita']['Returns'][number],
  | 'meta_centavos'
  | 'meta_mes_anterior_centavos'
  | 'percentual'
  | 'falta_centavos'
  | 'dias_restantes'
  | 'por_dia_centavos'
>

export function useProgressoMetaReceita(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['meta-receita', id, mes],
    queryFn: async () => {
      const linhas = await dados<ProgressoMeta[]>(
        supabase.rpc('progresso_meta_receita', { p_mes_ref: mes }),
      )
      return linhas[0] ?? null
    },
  })
}

export function useSalvarMetaReceita() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ mes, valor }: { mes: MesRef; valor: number | null }) => {
      if (valor === null) {
        await dados(supabase.from('metas_receita').delete().eq('user_id', uid).eq('mes_ref', mes))
        return
      }
      await dados(
        supabase
          .from('metas_receita')
          .upsert(
            { user_id: uid, mes_ref: mes, valor_meta_centavos: valor },
            { onConflict: 'user_id,mes_ref' },
          ),
      )
    },
    onSuccess: atualizar,
  })
}

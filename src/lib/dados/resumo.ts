import { useQuery } from '@tanstack/react-query'

import type { MesRef } from '../datas'
import { useUsuario } from '../sessao'
import { type Funcoes, supabase } from '../supabase'
import { type Anulavel, dados } from './comum'

export type ResumoMes = Anulavel<
  Funcoes['resumo_mes']['Returns'][number],
  | 'meta_desnecessario_centavos'
  | 'desnecessario_percentual'
  | 'desnecessario_projecao_centavos'
  | 'desnecessario_dias_para_estourar'
  | 'pode_gastar_dia_centavos'
>

export function useResumoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['resumo', id, mes],
    queryFn: async (): Promise<ResumoMes> => {
      const linhas = await dados(supabase.rpc('resumo_mes', { p_mes_ref: mes }))
      const resumo = linhas[0]
      // A função não devolve linha quando o banco não reconhece o usuário logado.
      if (!resumo) throw Object.assign(new Error('Resumo sem usuário.'), { code: 'PGRST301' })
      return resumo
    },
  })
}

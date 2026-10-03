import { useMutation, useQuery } from '@tanstack/react-query'

import { type DataISO, type MesRef, primeiroDia, ultimoDia } from '../datas'
import { gerarParcelas } from '../regras/cartao'
import { useUsuario } from '../sessao'
import { type Enums, type Linha, type NovaLinha, supabase } from '../supabase'
import { agoraISO, dados, useAtualizarTudo } from './comum'

const CAMPOS =
  'id, descricao, valor_centavos, data, origem, tipo, conta_id, cartao_id, categoria_id, parcela_atual, total_parcelas, grupo_parcelas, fatura_mes_ref'

export type Gasto = Pick<
  Linha<'gastos'>,
  | 'id'
  | 'descricao'
  | 'valor_centavos'
  | 'data'
  | 'origem'
  | 'tipo'
  | 'conta_id'
  | 'cartao_id'
  | 'categoria_id'
  | 'parcela_atual'
  | 'total_parcelas'
  | 'grupo_parcelas'
  | 'fatura_mes_ref'
>

export function useGastosDoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['gastos', id, mes],
    queryFn: () =>
      dados<Gasto[]>(
        supabase
          .from('gastos')
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

export function useGasto(gastoId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['gasto', id, gastoId],
    enabled: Boolean(gastoId),
    queryFn: () =>
      dados<Gasto | null>(
        supabase
          .from('gastos')
          .select(CAMPOS)
          .eq('user_id', id)
          .eq('id', gastoId ?? '')
          .is('deleted_at', null)
          .maybeSingle(),
      ),
  })
}

export interface DadosGasto {
  descricao: string
  /** Valor total da compra (em parcelado, é dividido entre as parcelas). */
  valor_centavos: number
  data: DataISO
  origem: Enums['origem_gasto']
  tipo: Enums['tipo_gasto']
  conta_id: string | null
  cartao_id: string | null
  categoria_id: string | null
  total_parcelas: number
}

/** Mesma normalização do gatilho aprendizado_categoria_preparar. */
export function normalizarTermo(descricao: string): string {
  return descricao.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Guarda "descrição → categoria e tipo" para sugerir da próxima vez. */
async function aprender(
  uid: string,
  gasto: Pick<DadosGasto, 'descricao' | 'categoria_id' | 'tipo'>,
) {
  const termo = normalizarTermo(gasto.descricao)
  if (!gasto.categoria_id || !termo) return
  // Sugestão é um extra: se falhar, o gasto já foi salvo e o usuário não é avisado.
  await supabase
    .from('aprendizado_categoria')
    .upsert(
      { user_id: uid, termo, categoria_id: gasto.categoria_id, tipo: gasto.tipo },
      { onConflict: 'user_id,termo' },
    )
}

export function useCriarGasto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (gasto: DadosGasto) => {
      const base = {
        user_id: uid,
        descricao: gasto.descricao,
        origem: gasto.origem,
        tipo: gasto.tipo,
        conta_id: gasto.origem === 'cartao' ? null : gasto.conta_id,
        cartao_id: gasto.origem === 'cartao' ? gasto.cartao_id : null,
        categoria_id: gasto.categoria_id,
      }
      let linhas: NovaLinha<'gastos'>[]
      if (gasto.origem === 'cartao' && gasto.total_parcelas > 1) {
        // Uma linha por parcela, no mesmo dia de cada mês; o resto vai na 1ª.
        const grupo = crypto.randomUUID()
        linhas = gerarParcelas(gasto.valor_centavos, gasto.data, gasto.total_parcelas).map((p) => ({
          ...base,
          valor_centavos: p.valorCentavos,
          data: p.data,
          parcela_atual: p.parcela,
          total_parcelas: gasto.total_parcelas,
          grupo_parcelas: grupo,
        }))
      } else {
        linhas = [{ ...base, valor_centavos: gasto.valor_centavos, data: gasto.data }]
      }
      // Um único insert: ou entram todas as parcelas, ou nenhuma.
      await dados(supabase.from('gastos').insert(linhas))
      await aprender(uid, gasto)
    },
    onSuccess: atualizar,
  })
}

/**
 * Em compra parcelada, descrição, categoria e tipo valem para todas as parcelas;
 * valor, data e cartão não mudam (para isso, exclua e lance de novo).
 */
export function useEditarGasto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ original, novo }: { original: Gasto; novo: DadosGasto }) => {
      if (original.grupo_parcelas) {
        await dados(
          supabase
            .from('gastos')
            .update({ descricao: novo.descricao, categoria_id: novo.categoria_id, tipo: novo.tipo })
            .eq('user_id', uid)
            .eq('grupo_parcelas', original.grupo_parcelas)
            .is('deleted_at', null),
        )
      } else {
        await dados(
          supabase
            .from('gastos')
            .update({
              descricao: novo.descricao,
              valor_centavos: novo.valor_centavos,
              data: novo.data,
              origem: novo.origem,
              tipo: novo.tipo,
              conta_id: novo.origem === 'cartao' ? null : novo.conta_id,
              cartao_id: novo.origem === 'cartao' ? novo.cartao_id : null,
              categoria_id: novo.categoria_id,
            })
            .eq('user_id', uid)
            .eq('id', original.id),
        )
      }
      await aprender(uid, novo)
    },
    onSuccess: atualizar,
  })
}

/** Exclusão lógica. Em parcelado, exclui todas as parcelas. Devolve os ids (para desfazer). */
export function useExcluirGasto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (gasto: Pick<Gasto, 'id' | 'grupo_parcelas'>) => {
      let consulta = supabase
        .from('gastos')
        .update({ deleted_at: agoraISO() })
        .eq('user_id', uid)
        .is('deleted_at', null)
      consulta = gasto.grupo_parcelas
        ? consulta.eq('grupo_parcelas', gasto.grupo_parcelas)
        : consulta.eq('id', gasto.id)
      const linhas = await dados(consulta.select('id'))
      return linhas.map((l) => l.id)
    },
    onSuccess: atualizar,
  })
}

/** Para o "Desfazer" (ver desfazerCom). */
export function restaurarGastos(uid: string, ids: string[]) {
  return supabase.from('gastos').update({ deleted_at: null }).eq('user_id', uid).in('id', ids)
}

/** Sugestão de categoria e tipo a partir do que o usuário já lançou com essa descrição. */
export function useSugestaoCategoria(descricao: string) {
  const { id } = useUsuario()
  const termo = normalizarTermo(descricao)
  return useQuery({
    queryKey: ['aprendizado', id, termo],
    queryFn: () =>
      dados<{ categoria_id: string; tipo: Enums['tipo_gasto'] } | null>(
        supabase
          .from('aprendizado_categoria')
          .select('categoria_id, tipo')
          .eq('user_id', id)
          .eq('termo', termo)
          .maybeSingle(),
      ),
    enabled: termo.length >= 2,
    staleTime: 5 * 60_000,
  })
}

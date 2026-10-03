import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type MesRef, primeiroDia, ultimoDia } from './datas'
import { useUsuario } from './sessao'
import { type NovaLinha, supabase } from './supabase'

/**
 * Leituras e gravações do MVP. Tudo roda com a sessão do usuário logado:
 * o RLS do banco garante que cada um só vê e grava os próprios dados.
 * O id do usuário entra na chave do cache para nunca misturar contas.
 */

export function useResumoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['resumo', id, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumo_mes', { p_mes_ref: mes })
      if (error) throw error
      const resumo = data[0]
      // A função não devolve linha quando o banco não reconhece o usuário logado.
      if (!resumo) throw Object.assign(new Error('Resumo sem usuário.'), { code: 'PGRST301' })
      return resumo
    },
  })
}

/** Contas com saldo atual, na ordem de criação (a Carteira padrão vem primeiro). */
export function useContas() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['contas', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('saldo_contas', {})
      if (error) throw error
      return data
    },
  })
}

export function useCategorias() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['categorias', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nome, cor')
        .eq('user_id', id)
        .order('nome')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useGastosDoMes(mes: MesRef) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['gastos', id, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select('id, descricao, valor_centavos, data, origem, tipo, conta_id, categoria_id')
        .eq('user_id', id)
        .is('deleted_at', null)
        .gte('data', primeiroDia(mes))
        .lte('data', ultimoDia(mes))
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useReceitasRecentes(limite = 20) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['receitas', id, limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receitas')
        .select('id, descricao, valor_centavos, data, conta_id')
        .eq('user_id', id)
        .is('deleted_at', null)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limite)
      if (error) throw error
      return data
    },
  })
}

/** Depois de gravar, recarrega tudo que depende de saldo e totais. */
function useAtualizarTotais() {
  const cliente = useQueryClient()
  return () =>
    Promise.all(
      ['resumo', 'contas', 'gastos', 'receitas'].map((chave) =>
        cliente.invalidateQueries({ queryKey: [chave] }),
      ),
    )
}

export type NovoGasto = Pick<
  NovaLinha<'gastos'>,
  'descricao' | 'valor_centavos' | 'data' | 'origem' | 'tipo' | 'conta_id' | 'categoria_id'
>

export function useCriarGasto() {
  const { id } = useUsuario()
  const atualizar = useAtualizarTotais()
  return useMutation({
    mutationFn: async (gasto: NovoGasto) => {
      const { error } = await supabase.from('gastos').insert({ ...gasto, user_id: id })
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export type NovaReceita = Pick<
  NovaLinha<'receitas'>,
  'descricao' | 'valor_centavos' | 'data' | 'conta_id'
>

export function useCriarReceita() {
  const { id } = useUsuario()
  const atualizar = useAtualizarTotais()
  return useMutation({
    mutationFn: async (receita: NovaReceita) => {
      const { error } = await supabase.from('receitas').insert({ ...receita, user_id: id })
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** Conta sugerida para dinheiro/Pix e receitas: a "Carteira" padrão, senão a primeira. */
export function contaPadrao<T extends { conta_id: string; nome: string }>(
  contas: readonly T[],
): T | undefined {
  return contas.find((c) => c.nome.trim().toLowerCase() === 'carteira') ?? contas[0]
}

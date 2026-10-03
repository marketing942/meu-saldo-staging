import { useMutation, useQuery } from '@tanstack/react-query'

import type { DataISO } from '../datas'
import { useUsuario } from '../sessao'
import { type Linha, supabase } from '../supabase'
import { agoraISO, dados, useAtualizarTudo } from './comum'

export type Projeto = Pick<
  Linha<'projetos'>,
  'id' | 'nome' | 'orcamento_centavos' | 'descontar_do_saldo' | 'conta_id' | 'arquivado'
>

export type GastoProjeto = Pick<
  Linha<'projeto_gastos'>,
  'id' | 'projeto_id' | 'descricao' | 'valor_centavos' | 'data'
>

/** Projetos com o total gasto em cada um (projetos ficam fora dos totais do mês). */
export function useProjetos() {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['projetos', id],
    queryFn: async () => {
      const [projetos, gastos] = await Promise.all([
        dados<Projeto[]>(
          supabase
            .from('projetos')
            .select('id, nome, orcamento_centavos, descontar_do_saldo, conta_id, arquivado')
            .eq('user_id', id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        ),
        dados(
          supabase
            .from('projeto_gastos')
            .select('projeto_id, valor_centavos')
            .eq('user_id', id)
            .is('deleted_at', null),
        ),
      ])
      const totais = new Map<string, number>()
      for (const g of gastos)
        totais.set(g.projeto_id, (totais.get(g.projeto_id) ?? 0) + g.valor_centavos)
      return projetos.map((p) => ({ ...p, total_centavos: totais.get(p.id) ?? 0 }))
    },
  })
}

export function useProjeto(projetoId: string | undefined) {
  const { id } = useUsuario()
  return useQuery({
    queryKey: ['projeto', id, projetoId],
    enabled: Boolean(projetoId),
    queryFn: async () => {
      const [projeto, gastos] = await Promise.all([
        dados<Projeto | null>(
          supabase
            .from('projetos')
            .select('id, nome, orcamento_centavos, descontar_do_saldo, conta_id, arquivado')
            .eq('user_id', id)
            .eq('id', projetoId ?? '')
            .is('deleted_at', null)
            .maybeSingle(),
        ),
        dados<GastoProjeto[]>(
          supabase
            .from('projeto_gastos')
            .select('id, projeto_id, descricao, valor_centavos, data')
            .eq('user_id', id)
            .eq('projeto_id', projetoId ?? '')
            .is('deleted_at', null)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false }),
        ),
      ])
      if (!projeto) return null
      const total = gastos.reduce((soma, g) => soma + g.valor_centavos, 0)
      return { projeto, gastos, total_centavos: total }
    },
  })
}

export interface DadosProjeto {
  nome: string
  orcamento_centavos: number | null
  descontar_do_saldo: boolean
  conta_id: string | null
}

export function useSalvarProjeto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({ id, ...projeto }: DadosProjeto & { id?: string }) => {
      const linha = { ...projeto, conta_id: projeto.descontar_do_saldo ? projeto.conta_id : null }
      if (id) {
        await dados(supabase.from('projetos').update(linha).eq('id', id).eq('user_id', uid))
        return id
      }
      const criado = await dados<{ id: string }>(
        supabase
          .from('projetos')
          .insert({ ...linha, user_id: uid })
          .select('id')
          .single(),
      )
      return criado.id
    },
    onSuccess: atualizar,
  })
}

export function useAlterarProjeto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async ({
      id,
      arquivado,
      excluir,
    }: {
      id: string
      arquivado?: boolean
      excluir?: boolean
    }) => {
      const alteracao =
        excluir === undefined ? { arquivado } : { deleted_at: excluir ? agoraISO() : null }
      await dados(supabase.from('projetos').update(alteracao).eq('id', id).eq('user_id', uid))
    },
    onSuccess: atualizar,
  })
}

export function useSalvarGastoProjeto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (gasto: {
      projeto_id: string
      descricao: string
      valor_centavos: number
      data: DataISO
    }) => {
      await dados(supabase.from('projeto_gastos').insert({ ...gasto, user_id: uid }))
    },
    onSuccess: atualizar,
  })
}

export function useExcluirGastoProjeto() {
  const { id: uid } = useUsuario()
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (id: string) => {
      await dados(
        supabase
          .from('projeto_gastos')
          .update({ deleted_at: agoraISO() })
          .eq('id', id)
          .eq('user_id', uid),
      )
    },
    onSuccess: atualizar,
  })
}

/** Para o "Desfazer" (ver desfazerCom). */
export function restaurarGastoProjeto(uid: string, id: string) {
  return supabase
    .from('projeto_gastos')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('user_id', uid)
}

export function restaurarProjeto(uid: string, id: string) {
  return supabase.from('projetos').update({ deleted_at: null }).eq('id', id).eq('user_id', uid)
}

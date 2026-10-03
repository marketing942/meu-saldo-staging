import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

import { supabase } from './supabase'

export interface EstadoSessao {
  sessao: Session | null
  /** true até o Supabase terminar de ler a sessão salva (ou o link de confirmação). */
  carregando: boolean
}

export const ContextoSessao = createContext<EstadoSessao | null>(null)

export function useSessao(): EstadoSessao {
  const contexto = useContext(ContextoSessao)
  if (!contexto) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  return contexto
}

/** Usuário logado. Só use em telas protegidas por <ExigeSessao>. */
export function useUsuario(): User {
  const { sessao } = useSessao()
  if (!sessao) throw new Error('Nenhum usuário logado.')
  return sessao.user
}

/** Encerra a sessão. O Supabase apaga a sessão local mesmo se a rede falhar. */
export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

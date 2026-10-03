import type { Session } from '@supabase/supabase-js'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { queryClient } from '@/lib/queryClient'
import { ContextoSessao } from '@/lib/sessao'
import { supabase } from '@/lib/supabase'

/**
 * Acompanha a sessão do Supabase Auth. A sessão fica salva no navegador
 * (persistSession) e o evento INITIAL_SESSION avisa quando ela já foi lida,
 * inclusive depois de trocar o código do link de confirmação de e-mail.
 */
export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao)
      setCarregando(false)
      // Ao sair, nada do usuário anterior fica no cache.
      if (evento === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const valor = useMemo(() => ({ sessao, carregando }), [sessao, carregando])
  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

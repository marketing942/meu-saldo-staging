import { useNavigate } from 'react-router'

/**
 * Volta para a tela anterior do app. Se a tela foi aberta direto (sem histórico
 * dentro do app), vai para `padrao` em vez de sair do site.
 */
export function useVoltar(padrao: string) {
  const navegar = useNavigate()
  return () => {
    const indice = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (indice > 0) void navegar(-1)
    else void navegar(padrao, { replace: true })
  }
}

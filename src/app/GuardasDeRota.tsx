import { Navigate, Outlet, useLocation } from 'react-router'

import { EstadoErro } from '@/components/ui/EstadoErro'
import { usePerfil } from '@/lib/dados/perfil'
import { useSessao } from '@/lib/sessao'

import { CarregandoTela } from './layouts/CarregandoTela'

function Aguardando() {
  return (
    <div className="mx-auto max-w-app pt-8 px-seguro">
      <CarregandoTela />
    </div>
  )
}

/** Área logada: sem sessão, manda para /entrar e lembra a tela pedida. */
export function ExigeSessao() {
  const { sessao, carregando } = useSessao()
  const local = useLocation()
  if (carregando) return <Aguardando />
  if (!sessao) {
    return <Navigate to="/entrar" replace state={{ de: `${local.pathname}${local.search}` }} />
  }
  return <Outlet />
}

/** Entrar e cadastro: quem já tem sessão vai direto para o app. */
export function SomenteVisitante() {
  const { sessao, carregando } = useSessao()
  const local = useLocation()
  if (carregando) return <Aguardando />
  if (sessao) {
    const de = (local.state as { de?: unknown } | null)?.de
    const destino = typeof de === 'string' && de.startsWith('/') && !de.startsWith('//') ? de : '/'
    return <Navigate to={destino} replace />
  }
  return <Outlet />
}

/** Área principal: quem ainda não passou pelo primeiro acesso vai para /onboarding. */
export function ExigeOnboarding() {
  const perfil = usePerfil()
  if (perfil.isPending) return <Aguardando />
  if (perfil.isError) {
    return (
      <div className="mx-auto max-w-app pt-8 px-seguro">
        <EstadoErro erro={perfil.error} aoTentarDeNovo={() => void perfil.refetch()} />
      </div>
    )
  }
  if (!perfil.data?.onboarding_concluido) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

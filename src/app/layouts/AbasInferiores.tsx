import { House, Landmark, type LucideIcon, Receipt, Target } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import { Icone } from '@/components/ui/Icone'
import { cn } from '@/lib/cn'

interface Aba {
  para: string
  rotulo: string
  icone: LucideIcon
}

const ABAS: readonly Aba[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/gastos', rotulo: 'Gastos', icone: Receipt },
  { para: '/dividas', rotulo: 'Dívidas', icone: Landmark },
  { para: '/metas', rotulo: 'Metas', icone: Target },
]

/** Barra de abas inferior. Mantém o ?mes= ao trocar de aba. */
export function AbasInferiores() {
  const { search } = useLocation()
  const mes = new URLSearchParams(search).get('mes')
  const sufixo = mes ? `?mes=${encodeURIComponent(mes)}` : ''

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-abas pb-seguro"
    >
      <ul className="mx-auto grid max-w-app grid-cols-4">
        {ABAS.map((aba) => (
          <li key={aba.para}>
            <NavLink
              to={`${aba.para}${sufixo}`}
              end={aba.para === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-destaque' : 'text-secundario hover:text-texto',
                )
              }
            >
              <Icone icone={aba.icone} />
              <span className="fonte-display text-[13px] leading-none">{aba.rotulo}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

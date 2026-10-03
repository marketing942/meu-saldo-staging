import { Settings } from 'lucide-react'
import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'

import { Icone } from '@/components/ui/Icone'
import { MARCA } from '@/config/marca'

import { AbasInferiores } from './AbasInferiores'
import { CarregandoTela } from './CarregandoTela'

/**
 * Casca das telas logadas: cabeçalho fixo, conteúdo em coluna de até 430px
 * e abas inferiores. A navegação por mês entra no cabeçalho na fase 3.
 */
export function LayoutApp() {
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-botao focus:bg-card focus:px-4 focus:py-3"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-10 border-b border-borda bg-fundo/95 pt-seguro backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-app items-center justify-between px-seguro">
          <span className="font-semibold">{MARCA.nome}</span>
          <Link
            to="/configuracoes"
            aria-label="Configurações"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-secundario hover:text-texto"
          >
            <Icone icone={Settings} />
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-app pt-4 px-seguro pb-28">
        <Suspense fallback={<CarregandoTela />}>
          <Outlet />
        </Suspense>
      </main>

      <AbasInferiores />
    </div>
  )
}

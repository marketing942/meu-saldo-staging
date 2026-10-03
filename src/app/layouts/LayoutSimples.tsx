import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { CarregandoTela } from './CarregandoTela'

/** Telas fora da área logada (entrar, cadastro, termos...): coluna central, sem abas. */
export function LayoutSimples() {
  return (
    <main id="conteudo" className="mx-auto min-h-dvh max-w-app py-8 pt-seguro px-seguro pb-seguro">
      <Suspense fallback={<CarregandoTela />}>
        <Outlet />
      </Suspense>
    </main>
  )
}

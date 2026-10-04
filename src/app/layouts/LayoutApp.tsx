import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'

import { Icone } from '@/components/ui/Icone'
import { SimboloMarca } from '@/components/ui/Marca'
import { formatarMesAno, mesAdd, mesAtual, situacaoDoMes } from '@/lib/datas'
import { useIrParaMes, useMes } from '@/lib/mes'

import { AbasInferiores } from './AbasInferiores'
import { Avisos } from './Avisos'
import { BotaoNovo } from './BotaoNovo'
import { CarregandoTela } from './CarregandoTela'
import { SincronizarPreferencias } from './SincronizarPreferencias'

const ROTULO_SITUACAO = { passado: 'realizado', atual: 'mês atual', futuro: 'previsto' } as const

/**
 * Casca das telas logadas: cabeçalho fixo com a navegação por mês, conteúdo em
 * coluna de até 430px, botão "+ Novo" e abas inferiores.
 */
export function LayoutApp() {
  const mes = useMes()
  const irParaMes = useIrParaMes()

  return (
    <div className="min-h-dvh">
      <SincronizarPreferencias />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-botao focus:bg-card focus:px-4 focus:py-3"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-10 border-b border-borda bg-fundo/95 pt-seguro backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-app items-center justify-between gap-2 px-seguro">
          <div className="flex items-center gap-1">
            <SimboloMarca className="h-6 w-auto shrink-0" />
            <nav aria-label="Mês" className="flex items-center">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => irParaMes(mesAdd(mes, -1))}
                className="inline-flex size-11 items-center justify-center rounded-full text-secundario hover:text-texto"
              >
                <Icone icone={ChevronLeft} />
              </button>
              <div className="min-w-36 text-center" aria-live="polite">
                <p className="fonte-display text-lg leading-tight">{formatarMesAno(mes)}</p>
                <p className="text-xs text-secundario">
                  {ROTULO_SITUACAO[situacaoDoMes(mes, mesAtual())]}
                </p>
              </div>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => irParaMes(mesAdd(mes, 1))}
                className="inline-flex size-11 items-center justify-center rounded-full text-secundario hover:text-texto"
              >
                <Icone icone={ChevronRight} />
              </button>
            </nav>
          </div>
          <Link
            to="/configuracoes"
            aria-label="Configurações"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-secundario hover:text-texto"
          >
            <Icone icone={Settings} />
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-app pt-4 px-seguro pb-40">
        <Suspense fallback={<CarregandoTela />}>
          <Outlet />
        </Suspense>
      </main>

      <BotaoNovo />
      <Avisos />
      <AbasInferiores />
    </div>
  )
}

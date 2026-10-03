import { HandCoins, Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import { Icone } from '@/components/ui/Icone'

/** Telas principais onde o "+ Novo" aparece (nos formulários ele some). */
const TELAS_COM_BOTAO = ['/', '/gastos', '/contas-a-pagar', '/metas']

export function BotaoNovo() {
  const { pathname } = useLocation()
  // Guarda em qual tela o menu foi aberto: ao navegar, ele fecha sozinho.
  const [abertoEm, setAbertoEm] = useState<string | null>(null)
  const aberto = abertoEm === pathname

  if (!TELAS_COM_BOTAO.includes(pathname) && !pathname.startsWith('/cartoes/')) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-app flex-col items-end gap-2 px-seguro">
      {aberto && (
        <div id="menu-novo" className="pointer-events-auto flex flex-col items-end gap-2">
          <Link
            to="/gastos/novo"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda bg-card px-4 font-medium"
          >
            <Icone icone={Receipt} tamanho={18} /> Gasto
          </Link>
          <Link
            to="/receitas/nova"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda bg-card px-4 font-medium"
          >
            <Icone icone={HandCoins} tamanho={18} /> Receita
          </Link>
        </div>
      )}
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-novo"
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-destaque px-5 font-semibold text-sobre-destaque"
      >
        <Icone icone={Plus} tamanho={18} /> Novo
      </button>
    </div>
  )
}

import { X } from 'lucide-react'
import { useEffect } from 'react'

import { Icone } from '@/components/ui/Icone'
import { useAvisos } from '@/stores/avisos'

/** Aviso rápido acima das abas. Com "Desfazer", fica 6 s na tela; sem, 3 s. */
export function Avisos() {
  const { aviso, fechar } = useAvisos()

  useEffect(() => {
    if (!aviso) return
    const espera = setTimeout(fechar, aviso.acao ? 6000 : 3000)
    return () => clearTimeout(espera)
  }, [aviso, fechar])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-seguro"
    >
      {aviso && (
        <div
          key={aviso.id}
          className="pointer-events-auto flex w-full max-w-[398px] items-center gap-2 rounded-card bg-texto py-1 pr-1 pl-4 text-sm text-fundo"
        >
          <span className="flex-1 py-2">{aviso.texto}</span>
          {aviso.acao && (
            <button
              type="button"
              className="min-h-11 rounded-botao px-3 font-semibold underline-offset-4 hover:underline"
              onClick={() => {
                aviso.acao?.executar()
                fechar()
              }}
            >
              {aviso.acao.rotulo}
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar aviso"
            className="inline-flex size-11 items-center justify-center rounded-full"
            onClick={fechar}
          >
            <Icone icone={X} tamanho={18} />
          </button>
        </div>
      )}
    </div>
  )
}

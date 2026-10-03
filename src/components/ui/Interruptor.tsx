import { useId } from 'react'

import { cn } from '@/lib/cn'

/** Liga/desliga (role="switch") com área de toque de 44px. */
export function Interruptor({
  rotulo,
  descricao,
  ligado,
  aoMudar,
  desabilitado = false,
}: {
  rotulo: string
  descricao?: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  desabilitado?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-rotulo`} className="font-medium">
          {rotulo}
        </p>
        {descricao && (
          <p id={`${id}-descricao`} className="text-sm text-secundario">
            {descricao}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={`${id}-rotulo`}
        aria-describedby={descricao ? `${id}-descricao` : undefined}
        disabled={desabilitado}
        onClick={() => aoMudar(!ligado)}
        className="inline-flex min-h-11 shrink-0 items-center disabled:opacity-50"
      >
        <span
          aria-hidden
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            ligado ? 'bg-destaque' : 'bg-borda',
          )}
        >
          <span
            className={cn(
              'inline-block size-5 rounded-full bg-card transition-transform',
              ligado ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </span>
      </button>
    </div>
  )
}

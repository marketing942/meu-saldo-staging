import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from 'react'

import { cn } from '@/lib/cn'

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  ajuda?: ReactNode
  erro?: string
  /** Elemento à direita dentro do campo (ex.: botão "Mostrar senha"). */
  acessorio?: ReactNode
}

/** Campo com label sempre visível, raio de 12px e altura mínima de 44px. */
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, ajuda, erro, acessorio, className, id, ...props },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined
  const idErro = erro ? `${idCampo}-erro` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idAjuda].filter(Boolean).join(' ') || undefined}
          className={cn(
            'min-h-11 w-full rounded-campo border bg-card px-3.5 text-base text-texto placeholder:text-secundario',
            erro ? 'border-desnecessario' : 'border-borda',
            acessorio ? 'pr-28' : undefined,
          )}
          {...props}
        />
        {acessorio && (
          <div className="absolute inset-y-0 right-1 flex items-center">{acessorio}</div>
        )}
      </div>
      {erro && (
        <p id={idErro} className="text-sm text-desnecessario">
          {erro}
        </p>
      )}
      {ajuda && (
        <p id={idAjuda} className="text-sm text-secundario">
          {ajuda}
        </p>
      )}
    </div>
  )
})

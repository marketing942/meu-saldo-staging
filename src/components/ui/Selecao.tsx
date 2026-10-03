import { type SelectHTMLAttributes, forwardRef, useId } from 'react'

import { cn } from '@/lib/cn'

export interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  erro?: string
}

/** Lista de opções com o mesmo visual do Campo. */
export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, className, id, children, ...props },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = erro ? `${idCampo}-erro` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <select
        ref={ref}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idErro}
        className={cn(
          'min-h-11 w-full rounded-campo border bg-card px-3 text-base text-texto',
          erro ? 'border-desnecessario' : 'border-borda',
        )}
        {...props}
      >
        {children}
      </select>
      {erro && (
        <p id={idErro} className="text-sm text-desnecessario">
          {erro}
        </p>
      )}
    </div>
  )
})

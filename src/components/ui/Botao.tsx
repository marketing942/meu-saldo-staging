import { type LucideIcon, LoaderCircle } from 'lucide-react'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { cn } from '@/lib/cn'

import { Icone } from './Icone'

type Variante = 'principal' | 'secundario' | 'texto' | 'perigo'

const estilos: Record<Variante, string> = {
  principal: 'rounded-botao bg-destaque text-sobre-destaque px-5 font-semibold hover:opacity-90',
  secundario:
    'rounded-botao border border-borda bg-card text-texto px-5 font-medium hover:bg-fundo',
  texto: 'rounded-botao px-2 font-medium text-destaque hover:underline underline-offset-4',
  perigo:
    'rounded-botao border border-desnecessario/40 bg-desnecessario/10 text-desnecessario px-5 font-semibold hover:bg-desnecessario/15',
}

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  carregando?: boolean
  larguraTotal?: boolean
  icone?: LucideIcon
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  {
    variante = 'principal',
    carregando = false,
    larguraTotal = false,
    icone,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 text-[15px] transition-opacity disabled:opacity-50',
        estilos[variante],
        larguraTotal && 'w-full',
        className,
      )}
      {...props}
    >
      {carregando ? (
        <Icone icone={LoaderCircle} tamanho={18} className="animate-spin" />
      ) : (
        icone && <Icone icone={icone} tamanho={18} />
      )}
      {children}
    </button>
  )
})

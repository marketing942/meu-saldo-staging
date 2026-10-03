import { type LucideIcon, LoaderCircle } from 'lucide-react'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { cn } from '@/lib/cn'

import { BASE_BOTAO, ESTILOS_BOTAO, type VarianteBotao } from './estilosBotao'
import { Icone } from './Icone'

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
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
      className={cn(BASE_BOTAO, ESTILOS_BOTAO[variante], larguraTotal && 'w-full', className)}
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

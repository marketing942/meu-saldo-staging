import type { LucideIcon } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/lib/cn'

import { BASE_BOTAO, ESTILOS_BOTAO, type VarianteBotao } from './estilosBotao'
import { Icone } from './Icone'

/** Link com o visual do Botao (navegação que parece botão). */
export function LinkBotao({
  variante = 'principal',
  icone,
  larguraTotal = false,
  className,
  children,
  ...props
}: LinkProps & { variante?: VarianteBotao; icone?: LucideIcon; larguraTotal?: boolean }) {
  return (
    <Link
      className={cn(BASE_BOTAO, ESTILOS_BOTAO[variante], larguraTotal && 'w-full', className)}
      {...props}
    >
      {icone && <Icone icone={icone} tamanho={18} />}
      {children}
    </Link>
  )
}

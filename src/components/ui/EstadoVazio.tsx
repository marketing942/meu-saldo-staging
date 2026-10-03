import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Icone } from './Icone'

/** Todo estado vazio tem texto amigável e um botão de ação. */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone: LucideIcon
  titulo: string
  descricao: ReactNode
  acao: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-borda bg-card px-6 py-10 text-center',
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-destaque/10 text-destaque">
        <Icone icone={icone} tamanho={24} />
      </span>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="max-w-[32ch] text-sm text-secundario">{descricao}</p>
      <div className="mt-2">{acao}</div>
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Icone } from './Icone'

type Tom = 'destaque' | 'necessario' | 'alerta' | 'desnecessario'

const tons: Record<Tom, string> = {
  destaque: 'bg-destaque/10 border-destaque/25 text-texto [--cor-icone:var(--destaque)]',
  necessario: 'bg-necessario/10 border-necessario/25 text-texto [--cor-icone:var(--necessario)]',
  alerta: 'bg-alerta/12 border-alerta/30 text-texto [--cor-icone:var(--alerta)]',
  desnecessario:
    'bg-desnecessario/10 border-desnecessario/25 text-texto [--cor-icone:var(--desnecessario)]',
}

/** Alerta com fundo levemente tingido, sem faixa lateral. */
export function Alerta({
  tom = 'destaque',
  icone,
  titulo,
  children,
  acao,
  className,
  anunciar = false,
}: {
  tom?: Tom
  icone?: LucideIcon
  titulo?: ReactNode
  children?: ReactNode
  acao?: ReactNode
  className?: string
  /** Anuncia para leitores de tela quando aparece. */
  anunciar?: boolean
}) {
  return (
    <div
      role={anunciar ? 'status' : undefined}
      className={cn('flex gap-3 rounded-card border p-4', tons[tom], className)}
    >
      {icone && <Icone icone={icone} className="mt-0.5 shrink-0 text-[var(--cor-icone)]" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-sm text-texto">{children}</div>}
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </div>
  )
}

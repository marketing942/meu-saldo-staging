import { cn } from '@/lib/cn'

/** Bloco de carregamento. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulsar rounded-campo bg-borda', className)} />
}

/** Agrupa esqueletos e anuncia o carregamento para leitores de tela. */
export function Carregando({
  rotulo = 'Carregando',
  children,
  className,
}: {
  rotulo?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  )
}

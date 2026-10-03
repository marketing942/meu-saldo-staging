import { cn } from '@/lib/cn'

/** Barra de progresso; `marcos` desenha divisões (ex.: 25, 50 e 75%). */
export function BarraProgresso({
  percentual,
  rotulo,
  cor = 'bg-destaque',
  marcos,
  className,
}: {
  percentual: number
  rotulo: string
  cor?: string
  marcos?: readonly number[]
  className?: string
}) {
  const largura = Math.max(0, Math.min(percentual, 100))
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(largura)}
      className={cn('relative h-2.5 overflow-hidden rounded-full bg-borda', className)}
    >
      <div className={cn('h-full rounded-full', cor)} style={{ width: `${largura}%` }} />
      {marcos?.map((marco) => (
        <span
          key={marco}
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-card"
          style={{ left: `${marco}%` }}
        />
      ))}
    </div>
  )
}

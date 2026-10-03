import { cn } from '@/lib/cn'

/** Inicial do nome em círculo de 40px (cor de destaque a 10%). */
export function Inicial({ nome, className }: { nome: string; className?: string }) {
  const letra = nome.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-destaque/10 text-base font-semibold text-destaque',
        className,
      )}
    >
      {letra}
    </span>
  )
}

import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/** Card: borda de 1px, cantos de 16px, sem sombra e sem degradê. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('rounded-card border border-borda bg-card p-4', className)} {...props} />
  )
}

export function TituloCard({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-sm font-medium text-secundario', className)} {...props}>
      {children}
    </h2>
  )
}

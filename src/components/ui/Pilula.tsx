import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/** Filtro em pílula (chip). Use `ativa` para o estado selecionado. */
export function Pilula({
  ativa = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ativa?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={ativa}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
        ativa
          ? 'border-destaque bg-destaque text-sobre-destaque'
          : 'border-borda bg-card text-texto hover:bg-fundo',
        className,
      )}
      {...props}
    />
  )
}

import type { LucideIcon, LucideProps } from 'lucide-react'

/** Ícones de traço fino (lucide, stroke 1.7). Decorativos por padrão. */
export function Icone({
  icone: Componente,
  tamanho = 22,
  rotulo,
  ...props
}: Omit<LucideProps, 'ref' | 'size'> & { icone: LucideIcon; tamanho?: number; rotulo?: string }) {
  return (
    <Componente
      size={tamanho}
      strokeWidth={1.7}
      aria-hidden={rotulo ? undefined : true}
      aria-label={rotulo}
      role={rotulo ? 'img' : undefined}
      focusable="false"
      {...props}
    />
  )
}

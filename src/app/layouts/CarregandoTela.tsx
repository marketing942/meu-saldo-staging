import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'

/** Skeleton genérico enquanto o código de uma tela é carregado. */
export function CarregandoTela() {
  return (
    <Carregando className="flex flex-col gap-4">
      <Esqueleto className="h-7 w-40" />
      <Esqueleto className="h-32 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-4">
        <Esqueleto className="h-24 rounded-card" />
        <Esqueleto className="h-24 rounded-card" />
      </div>
      <Esqueleto className="h-48 w-full rounded-card" />
    </Carregando>
  )
}

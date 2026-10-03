import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { cn } from '@/lib/cn'
import { LIMITE_ALERTA_PERCENTUAL } from '@/lib/regras/cartao'
import { useFormatarValor } from '@/lib/valores'

export interface ValoresLimite {
  limiteCentavos: number
  usadoCentavos: number
  disponivelCentavos: number
  percentual: number
}

/** Cor da barra: normal, alerta a partir de 80% e estourado a partir de 100%. */
function corDoLimite(percentual: number): string {
  if (percentual >= 100) return 'bg-desnecessario'
  if (percentual >= LIMITE_ALERTA_PERCENTUAL) return 'bg-alerta'
  return 'bg-destaque'
}

/**
 * Limite total, usado (com a porcentagem), disponível e a barra de uso.
 * `compacto`: uma linha por valor, para o carrossel do Início.
 */
export function ResumoLimite({
  nomeCartao,
  limite,
  compacto = false,
}: {
  nomeCartao: string
  limite: ValoresLimite
  compacto?: boolean
}) {
  const formatar = useFormatarValor()
  const pct = Math.round(limite.percentual)
  const itens = [
    { rotulo: 'Limite total', valor: formatar(limite.limiteCentavos) },
    { rotulo: 'Usado', valor: `${formatar(limite.usadoCentavos)} · ${pct}%` },
    {
      rotulo: 'Disponível',
      valor: formatar(limite.disponivelCentavos),
      negativo: limite.disponivelCentavos < 0,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <BarraProgresso
        rotulo={`Limite usado do cartão ${nomeCartao}: ${pct}%`}
        percentual={limite.percentual}
        cor={corDoLimite(limite.percentual)}
      />
      <dl
        className={cn(
          compacto ? 'flex flex-col gap-0.5 text-xs' : 'grid grid-cols-3 gap-2 text-sm',
        )}
      >
        {itens.map((item) => (
          <div
            key={item.rotulo}
            className={compacto ? 'flex justify-between gap-2' : 'flex flex-col'}
          >
            <dt className="text-secundario">{item.rotulo}</dt>
            <dd
              className={cn(
                'valor font-medium',
                item.negativo ? 'text-desnecessario' : 'text-texto',
              )}
            >
              {item.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

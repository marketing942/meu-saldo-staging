import { CircleAlert, RotateCw } from 'lucide-react'

import { cn } from '@/lib/cn'
import { mensagemDeErro } from '@/lib/erros'

import { Botao } from './Botao'
import { Icone } from './Icone'

/** Todo erro tem mensagem clara e "Tentar de novo". */
export function EstadoErro({
  erro,
  mensagem,
  aoTentarDeNovo,
  className,
}: {
  erro?: unknown
  mensagem?: string
  aoTentarDeNovo: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-desnecessario/25 bg-desnecessario/10 px-6 py-8 text-center',
        className,
      )}
    >
      <Icone icone={CircleAlert} tamanho={24} className="text-desnecessario" />
      <p className="max-w-[34ch] text-sm text-texto">{mensagem ?? mensagemDeErro(erro)}</p>
      <Botao variante="secundario" icone={RotateCw} onClick={aoTentarDeNovo}>
        Tentar de novo
      </Botao>
    </div>
  )
}

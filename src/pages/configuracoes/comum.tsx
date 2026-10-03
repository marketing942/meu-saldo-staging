import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { LinkBotao } from '@/components/ui/LinkBotao'

/** Topo das subtelas de Configurações, com volta para a tela principal. */
export function CabecalhoConfig({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <LinkBotao to="/configuracoes" variante="texto" icone={ArrowLeft} className="self-start">
        Configurações
      </LinkBotao>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          {descricao && <p className="text-sm text-secundario">{descricao}</p>}
        </div>
        {acao}
      </div>
    </div>
  )
}

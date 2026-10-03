import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Botao } from './Botao'
import type { VarianteBotao } from './estilosBotao'

/** Botão que pede confirmação ali mesmo antes de executar (sem janela modal). */
export function ConfirmarAcao({
  rotulo,
  pergunta,
  rotuloConfirmar,
  aoConfirmar,
  carregando = false,
  icone,
  variante = 'perigo',
  larguraTotal = false,
}: {
  rotulo: string
  pergunta: string
  rotuloConfirmar: string
  aoConfirmar: () => void
  carregando?: boolean
  icone?: LucideIcon
  variante?: VarianteBotao
  larguraTotal?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) {
    return (
      <Botao
        variante={variante}
        icone={icone}
        larguraTotal={larguraTotal}
        onClick={() => setAberto(true)}
      >
        {rotulo}
      </Botao>
    )
  }
  return (
    <div
      role="group"
      aria-label={pergunta}
      className="flex flex-col gap-3 rounded-card border border-desnecessario/25 bg-desnecessario/10 p-3"
    >
      <p className="text-sm">{pergunta}</p>
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={() => setAberto(false)} disabled={carregando}>
          Cancelar
        </Botao>
        <Botao variante="perigo" carregando={carregando} onClick={aoConfirmar}>
          {rotuloConfirmar}
        </Botao>
      </div>
    </div>
  )
}

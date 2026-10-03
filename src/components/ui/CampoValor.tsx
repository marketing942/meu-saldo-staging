import { type Centavos, centavosDeDigitos, formatarCentavosParaCampo } from '@/lib/dinheiro'

import { Campo } from './Campo'

/** Valor em reais com teclado numérico: os dígitos entram pela direita (centavos). */
export function CampoValor({
  rotulo = 'Valor (R$)',
  centavos,
  aoMudar,
  erro,
  desabilitado = false,
}: {
  rotulo?: string
  centavos: Centavos
  aoMudar: (centavos: Centavos) => void
  erro?: string
  desabilitado?: boolean
}) {
  return (
    <Campo
      rotulo={rotulo}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0,00"
      className="valor"
      value={centavos > 0 ? formatarCentavosParaCampo(centavos) : ''}
      onChange={(e) => aoMudar(centavosDeDigitos(e.target.value))}
      erro={erro}
      disabled={desabilitado}
    />
  )
}

import { useCallback } from 'react'

import { useUI } from '@/stores/ui'

import { type Centavos, formatarValor } from './dinheiro'

/** Formata em R$ respeitando "ocultar valores". */
export function useFormatarValor() {
  const ocultar = useUI((estado) => estado.ocultarValores)
  return useCallback((centavos: Centavos) => formatarValor(centavos, ocultar), [ocultar])
}

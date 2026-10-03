import { useEffect, useState } from 'react'

/** Valor que só muda depois de `ms` sem alterações (ex.: busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms = 400): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(espera)
  }, [valor, ms])
  return atrasado
}

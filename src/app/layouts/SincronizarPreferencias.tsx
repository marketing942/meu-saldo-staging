import { useEffect } from 'react'

import { usePerfil } from '@/lib/dados/perfil'
import { useUI } from '@/stores/ui'

/**
 * Tema e "ocultar valores" ficam no perfil (valem em qualquer aparelho) e têm
 * uma cópia local para o app já abrir com a escolha certa. Quando o perfil
 * chega, a cópia local é atualizada.
 */
export function SincronizarPreferencias() {
  const { data: perfil } = usePerfil()
  const { tema, ocultarValores, definirTema, definirOcultarValores } = useUI()

  useEffect(() => {
    if (!perfil) return
    if (perfil.tema !== tema) definirTema(perfil.tema)
    if (perfil.ocultar_valores !== ocultarValores) definirOcultarValores(perfil.ocultar_valores)
    // Só reage ao perfil: a cópia local segue o servidor, não o contrário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.tema, perfil?.ocultar_valores])

  return null
}

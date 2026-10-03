import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type MesRef, mesAtual } from '@/lib/datas'
import { type Tema, aplicarTema } from '@/lib/tema'

/**
 * Estado de interface (não são dados do servidor):
 * - mês selecionado: espelha ?mes= na URL e o perfil (sincronizado na navegação por mês);
 * - ocultar valores e tema: cópia local das preferências do perfil, para abrir o app
 *   já com a escolha certa antes do perfil carregar.
 */
interface EstadoUI {
  mesSelecionado: MesRef
  ocultarValores: boolean
  tema: Tema
  definirMes: (mes: MesRef) => void
  definirOcultarValores: (ocultar: boolean) => void
  definirTema: (tema: Tema) => void
}

function armazenamentoSeguro() {
  try {
    return window.localStorage
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue sem persistir.
    const memoria = new Map<string, string>()
    return {
      getItem: (chave: string) => memoria.get(chave) ?? null,
      setItem: (chave: string, valor: string) => void memoria.set(chave, valor),
      removeItem: (chave: string) => void memoria.delete(chave),
    }
  }
}

export const useUI = create<EstadoUI>()(
  persist(
    (set) => ({
      mesSelecionado: mesAtual(),
      ocultarValores: false,
      tema: 'sistema',
      definirMes: (mes) => set({ mesSelecionado: mes }),
      definirOcultarValores: (ocultar) => set({ ocultarValores: ocultar }),
      definirTema: (tema) => {
        aplicarTema(tema)
        set({ tema })
      },
    }),
    {
      name: 'financas:ui',
      version: 1,
      storage: createJSONStorage(armazenamentoSeguro),
      // O mês não é guardado aqui: vem da URL ou do perfil.
      partialize: ({ ocultarValores, tema }) => ({ ocultarValores, tema }),
      onRehydrateStorage: () => (estado) => {
        if (estado) aplicarTema(estado.tema)
      },
    },
  ),
)

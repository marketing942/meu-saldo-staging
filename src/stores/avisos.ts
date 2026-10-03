import { create } from 'zustand'

export interface Aviso {
  id: number
  texto: string
  acao?: { rotulo: string; executar: () => void }
}

interface EstadoAvisos {
  aviso: Aviso | null
  mostrar: (texto: string, acao?: Aviso['acao']) => void
  fechar: () => void
}

let proximoId = 1

/** Aviso rápido no rodapé ("Gasto salvo", "Gasto excluído · Desfazer"). */
export const useAvisos = create<EstadoAvisos>()((set) => ({
  aviso: null,
  mostrar: (texto, acao) => set({ aviso: { id: proximoId++, texto, acao } }),
  fechar: () => set({ aviso: null }),
}))

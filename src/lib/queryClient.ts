import { QueryClient } from '@tanstack/react-query'

import { ehErroDeRede } from './erros'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      // Repete só falhas de rede; erros do banco (RLS, validação) não melhoram repetindo.
      retry: (tentativas, erro) => tentativas < 2 && ehErroDeRede(erro),
    },
    mutations: {
      retry: false,
    },
  },
})

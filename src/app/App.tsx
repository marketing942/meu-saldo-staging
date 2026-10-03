import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'

import { queryClient } from '@/lib/queryClient'

import { ProvedorSessao } from './ProvedorSessao'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorSessao>
        <RouterProvider router={router} />
      </ProvedorSessao>
    </QueryClientProvider>
  )
}

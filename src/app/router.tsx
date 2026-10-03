import { type RouteObject, createBrowserRouter } from 'react-router'

import { TelaEmConstrucao } from '@/pages/TelaEmConstrucao'

import { ErroDeRota } from './ErroDeRota'
import { CarregandoTela } from './layouts/CarregandoTela'
import { LayoutApp } from './layouts/LayoutApp'
import { LayoutSimples } from './layouts/LayoutSimples'

/** Rota temporária: trocada pela tela definitiva (com `lazy`) na fase indicada. */
const emConstrucao = (titulo: string, fase: number): Pick<RouteObject, 'element'> => ({
  element: <TelaEmConstrucao titulo={titulo} fase={fase} />,
})

/**
 * Mapa de rotas. O mês selecionado vai na URL (?mes=AAAA-MM) em todas as telas logadas.
 * Telas são carregadas sob demanda (code splitting) com `lazy`.
 */
export const rotas: RouteObject[] = [
  {
    errorElement: <ErroDeRota />,
    // Mostrado ao abrir o app direto numa tela carregada sob demanda.
    hydrateFallbackElement: <CarregandoTela />,
    children: [
      {
        element: <LayoutApp />,
        children: [
          { index: true, ...emConstrucao('Início', 3) },
          { path: 'gastos', ...emConstrucao('Gastos', 4) },
          { path: 'cartoes/:cartaoId', ...emConstrucao('Cartão', 4) },
          { path: 'dividas', ...emConstrucao('Dívidas', 5) },
          { path: 'metas', ...emConstrucao('Metas', 6) },
          { path: 'configuracoes', ...emConstrucao('Configurações', 6) },
        ],
      },
      {
        element: <LayoutSimples />,
        children: [
          { path: 'entrar', ...emConstrucao('Entrar', 3) },
          { path: 'cadastro', ...emConstrucao('Cadastro', 3) },
          { path: 'esqueci-senha', ...emConstrucao('Esqueci minha senha', 3) },
          { path: 'nova-senha', ...emConstrucao('Nova senha', 3) },
          { path: 'onboarding', ...emConstrucao('Primeiros passos', 3) },
          { path: 'termos', ...emConstrucao('Termos de uso', 3) },
          { path: 'privacidade', ...emConstrucao('Política de privacidade', 3) },
          {
            path: '*',
            lazy: () => import('@/pages/NaoEncontrada').then((m) => ({ Component: m.default })),
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(rotas)

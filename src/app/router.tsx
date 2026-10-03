import type { ComponentType } from 'react'
import { type RouteObject, createBrowserRouter } from 'react-router'

import { ErroDeRota } from './ErroDeRota'
import { ExigeOnboarding, ExigeSessao, SomenteVisitante } from './GuardasDeRota'
import { CarregandoTela } from './layouts/CarregandoTela'
import { LayoutApp } from './layouts/LayoutApp'
import { LayoutSimples } from './layouts/LayoutSimples'

/** Tela carregada sob demanda (code splitting): o módulo exporta o componente como default. */
const tela = (carregar: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: () => carregar().then((m) => ({ Component: m.default })),
})

/**
 * Mapa de rotas. O mês selecionado vai na URL (?mes=AAAA-MM) nas telas logadas.
 * Área logada: <ExigeSessao> (sem login vai para /entrar) e <ExigeOnboarding>
 * (primeiro acesso vai para /onboarding). Entrar, cadastro e "esqueci a senha"
 * ficam atrás de <SomenteVisitante> (quem já entrou vai para o app).
 */
export const rotas: RouteObject[] = [
  {
    errorElement: <ErroDeRota />,
    // Mostrado ao abrir o app direto numa tela carregada sob demanda.
    hydrateFallbackElement: <CarregandoTela />,
    children: [
      {
        element: <ExigeSessao />,
        children: [
          {
            element: <ExigeOnboarding />,
            children: [
              {
                element: <LayoutApp />,
                children: [
                  { index: true, ...tela(() => import('@/pages/Inicio')) },
                  { path: 'gastos', ...tela(() => import('@/pages/gastos/Gastos')) },
                  { path: 'gastos/novo', ...tela(() => import('@/pages/gastos/FormGasto')) },
                  { path: 'gastos/:gastoId', ...tela(() => import('@/pages/gastos/FormGasto')) },
                  { path: 'receitas', ...tela(() => import('@/pages/receitas/Receitas')) },
                  { path: 'receitas/nova', ...tela(() => import('@/pages/receitas/FormReceita')) },
                  {
                    path: 'receitas/:receitaId',
                    ...tela(() => import('@/pages/receitas/FormReceita')),
                  },
                  { path: 'cartoes/:cartaoId', ...tela(() => import('@/pages/cartoes/Cartao')) },
                  { path: 'dividas', ...tela(() => import('@/pages/dividas/Dividas')) },
                  { path: 'dividas/nova', ...tela(() => import('@/pages/dividas/FormDivida')) },
                  {
                    path: 'dividas/:dividaId',
                    ...tela(() => import('@/pages/dividas/FormDivida')),
                  },
                  { path: 'metas', ...tela(() => import('@/pages/metas/Metas')) },
                  {
                    path: 'metas/projetos/:projetoId',
                    ...tela(() => import('@/pages/metas/Projeto')),
                  },
                  {
                    path: 'configuracoes',
                    ...tela(() => import('@/pages/configuracoes/Configuracoes')),
                  },
                  {
                    path: 'configuracoes/contas',
                    ...tela(() => import('@/pages/configuracoes/Contas')),
                  },
                  {
                    path: 'configuracoes/cartoes',
                    ...tela(() => import('@/pages/configuracoes/Cartoes')),
                  },
                  {
                    path: 'configuracoes/categorias',
                    ...tela(() => import('@/pages/configuracoes/Categorias')),
                  },
                  {
                    path: 'configuracoes/excluir-conta',
                    ...tela(() => import('@/pages/configuracoes/ExcluirConta')),
                  },
                ],
              },
            ],
          },
          {
            element: <LayoutSimples />,
            children: [{ path: 'onboarding', ...tela(() => import('@/pages/Onboarding')) }],
          },
        ],
      },
      {
        element: <LayoutSimples />,
        children: [
          {
            element: <SomenteVisitante />,
            children: [
              { path: 'entrar', ...tela(() => import('@/pages/auth/Entrar')) },
              { path: 'cadastro', ...tela(() => import('@/pages/auth/Cadastro')) },
              { path: 'esqueci-senha', ...tela(() => import('@/pages/auth/EsqueciSenha')) },
            ],
          },
          { path: 'nova-senha', ...tela(() => import('@/pages/auth/NovaSenha')) },
          { path: 'termos', ...tela(() => import('@/pages/legal/Termos')) },
          { path: 'privacidade', ...tela(() => import('@/pages/legal/Privacidade')) },
          { path: '*', ...tela(() => import('@/pages/NaoEncontrada')) },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(rotas)

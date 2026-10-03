import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { hoje } from '@/lib/datas'

import { type SupabaseFalso } from './supabase-falso'
import { entrar, expect, test } from './fixtures'

/** Usuário com um pouco de tudo, para as telas não ficarem vazias. */
function popular(banco: SupabaseFalso) {
  const u = banco.criarUsuario('ana@exemplo.com', 'senha123', 'Ana', true)
  const carteira = banco.linhas('contas', u.id)[0]?.id ?? ''
  const cartao = banco.inserir(u.id, 'cartoes', {
    nome: 'Nubank',
    limite_centavos: 300000,
    dia_fechamento: 5,
    dia_vencimento: 12,
  })
  banco.inserir(u.id, 'receitas', {
    descricao: 'Salário',
    valor_centavos: 400000,
    conta_id: carteira,
  })
  banco.inserir(u.id, 'gastos', {
    descricao: 'Mercado',
    valor_centavos: 25000,
    origem: 'pix',
    conta_id: carteira,
    tipo: 'necessario',
  })
  banco.inserir(u.id, 'gastos', {
    descricao: 'Cinema',
    valor_centavos: 4000,
    origem: 'cartao',
    cartao_id: cartao.id,
    tipo: 'desnecessario',
    data: hoje(),
  })
  banco.inserir(u.id, 'dividas', {
    nome: 'Aluguel',
    tipo: 'aluguel',
    valor_parcela_centavos: 150000,
    dia_vencimento: 28,
    infinita: true,
    forma_pagamento: 'conta',
    conta_id: carteira,
  })
  return { cartao: cartao.id }
}

const TELAS_LOGADAS = [
  '/',
  '/gastos',
  '/gastos/novo',
  '/gastos?aba=receitas',
  '/receitas/nova',
  '/contas-a-pagar',
  '/contas-a-pagar/nova',
  '/metas',
  '/configuracoes',
  '/configuracoes/cartoes',
]

async function verificar(page: Page, tela: string) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    graves.map((v) => `${tela}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
  ).toEqual([])
}

for (const esquema of ['light', 'dark'] as const) {
  test.describe(`tema ${esquema === 'light' ? 'claro' : 'escuro'}`, () => {
    test.use({ colorScheme: esquema })

    test('telas públicas sem violações graves de acessibilidade', async ({ page }) => {
      for (const tela of ['/entrar', '/cadastro', '/esqueci-senha', '/termos']) {
        await page.goto(tela)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await verificar(page, tela)
      }
    })

    test('telas do app sem violações graves de acessibilidade', async ({ page, banco }) => {
      const { cartao } = popular(banco)
      await entrar(page, 'ana@exemplo.com', 'senha123')
      await expect(page.getByText('Saldo total')).toBeVisible()
      for (const tela of [...TELAS_LOGADAS, `/cartoes/${cartao}`]) {
        await page.goto(tela)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await page.waitForLoadState('networkidle')
        await verificar(page, tela)
      }
    })
  })
}

import { hoje } from '@/lib/datas'

import { digitarValor, expect, test, usuarioLogado } from './fixtures'

test('meta de receita: salvar, acompanhar progresso e remover', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.getByRole('link', { name: 'Metas' }).click()
  await digitarValor(page, 'Quero receber (R$)', '300000')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(page.getByText('0% da meta')).toBeVisible()

  banco.inserir(usuario.id, 'receitas', {
    descricao: 'Freela',
    valor_centavos: 150000,
    data: hoje(),
    conta_id: usuario.carteira,
  })
  await page.reload()
  await expect(page.getByText('50% da meta')).toBeVisible()
  await expect(page.getByText('Faltam R$ 1.500,00')).toBeVisible()
  await expect(page.getByText(/Para chegar lá, entre/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Freela/ })).toBeVisible()

  await page.getByRole('button', { name: 'Remover meta' }).click()
  await expect(page.getByText('Meta removida.')).toBeVisible()
  expect(banco.linhas('metas_receita', usuario.id)).toHaveLength(0)
})

test('meta de desnecessários gera alerta no Início', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/metas?aba=desnecessarios')
  await digitarValor(page, 'Limite por mês (R$)', '10000')
  await page.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(page.getByText('Meta salva.')).toBeVisible()
  expect(banco.linhas('profiles', usuario.id)[0]?.meta_desnecessario_centavos).toBe(10000)

  banco.inserir(usuario.id, 'gastos', {
    descricao: 'Delivery',
    valor_centavos: 9500,
    origem: 'pix',
    conta_id: usuario.carteira,
    tipo: 'desnecessario',
    data: hoje(),
  })
  await page.goto('/')
  await expect(page.getByText('Atenção aos gastos desnecessários')).toBeVisible()
  await expect(page.getByText(/Você já usou 95% da meta de R\$ 100,00/)).toBeVisible()
})

test('projeto: criar, lançar gasto, ver orçamento e excluir gasto com desfazer', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/metas?aba=projetos')
  await page.getByRole('button', { name: 'Novo projeto' }).click()
  await page.getByLabel('Nome do projeto').fill('Festa de aniversário')
  await digitarValor(page, /Orçamento/, '100000')
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByRole('heading', { name: 'Festa de aniversário' })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar gasto ao projeto' }).click()
  await digitarValor(page, 'Valor (R$)', '20000')
  await page.getByLabel('Descrição').fill('Bolo')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('20% do orçamento de R$ 1.000,00 · restam R$ 800,00')).toBeVisible()
  expect(banco.linhas('projeto_gastos', usuario.id)[0]).toMatchObject({
    descricao: 'Bolo',
    valor_centavos: 20000,
  })
  // Projeto não entra nos gastos do mês.
  expect(banco.resumoMes(usuario.id, hoje().slice(0, 7)).gastos_mes_centavos).toBe(0)

  await page.getByRole('button', { name: 'Excluir Bolo' }).click()
  await expect(page.getByText('Gasto do projeto excluído.')).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('Bolo')).toBeVisible()
})

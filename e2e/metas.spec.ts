import { hoje } from '@/lib/datas'

import { digitarValor, expect, test, usuarioLogado } from './fixtures'

test('Metas tem a previsão de desnecessários e os projetos, sem meta de receita', async ({
  page,
  banco,
}) => {
  await usuarioLogado(page, banco)
  await page.getByRole('link', { name: 'Metas' }).click()
  await expect(page.getByRole('heading', { name: 'Metas', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Previsão de desnecessários' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Projetos', level: 2 })).toBeVisible()
  await expect(page.getByText(/meta de receita/i)).toHaveCount(0)
  await expect(page.getByText(/meta de desnecessários/i)).toHaveCount(0)
})

test('previsão de desnecessários: salvar, acompanhar no mês e alertas no Início', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/metas')
  await digitarValor(page, 'Quanto prevejo gastar com desnecessários por mês (R$)', '10000')
  await page.getByRole('button', { name: 'Salvar previsão' }).click()
  await expect(page.getByText('Previsão salva.')).toBeVisible()
  expect(banco.linhas('profiles', usuario.id)[0]?.meta_desnecessario_centavos).toBe(10000)

  const gasto = { origem: 'pix', conta_id: usuario.carteira, tipo: 'desnecessario', data: hoje() }
  banco.inserir(usuario.id, 'gastos', { ...gasto, descricao: 'Delivery', valor_centavos: 9500 })
  await page.reload()
  await expect(page.getByText('Ainda restam R$ 5,00 na previsão deste mês.')).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: 'Uso da previsão de desnecessários' }),
  ).toHaveAttribute('aria-valuenow', '95')

  await page.goto('/')
  await expect(page.getByText('Atenção aos gastos desnecessários')).toBeVisible()
  await expect(
    page.getByText(/Você já usou 95% da sua previsão de desnecessários \(R\$ 100,00\)/),
  ).toBeVisible()
  await expect(page.getByText('Previsão de desnecessários: R$ 100,00 · 95% usado')).toBeVisible()

  banco.inserir(usuario.id, 'gastos', { ...gasto, descricao: 'Cinema', valor_centavos: 1000 })
  await page.reload()
  await expect(page.getByText('Você ultrapassou sua previsão em R$ 5,00')).toBeVisible()
  await page.goto('/metas')
  await expect(page.getByText('Você ultrapassou a previsão em R$ 5,00.')).toBeVisible()
})

test('projeto: criar, lançar gasto, ver orçamento e excluir gasto com desfazer', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/metas')
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

  await page.getByRole('link', { name: 'Projetos' }).click()
  await expect(page).toHaveURL(/\/metas$/)
  await expect(page.getByRole('link', { name: /Festa de aniversário/ })).toBeVisible()
})

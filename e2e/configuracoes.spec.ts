import { expect, test, usuarioLogado } from './fixtures'

test('tema e ocultar valores ficam no perfil', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro')
  await page.getByRole('switch', { name: 'Ocultar valores' }).click()
  await expect.poll(() => banco.linhas('profiles', usuario.id)[0]?.ocultar_valores).toBe(true)
  expect(banco.linhas('profiles', usuario.id)[0]?.tema).toBe('escuro')

  await page.goto('/')
  await expect(page.getByText('R$ ••••').first()).toBeVisible()
  await page.getByRole('button', { name: 'Mostrar valores' }).click()
  await expect(page.getByText('R$ 0,00').first()).toBeVisible()
})

test('contas, categorias e proteção ao excluir conta com lançamentos', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/configuracoes/contas')
  await page.getByRole('button', { name: 'Nova conta' }).click()
  await page.getByLabel('Nome').fill('Banco')
  await page.getByLabel('Saldo inicial (R$)').pressSequentially('100000')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Conta criada.')).toBeVisible()
  await expect(page.getByText('R$ 1.000,00')).toBeVisible()

  banco.inserir(usuario.id, 'receitas', {
    descricao: 'Salário',
    valor_centavos: 1000,
    conta_id: usuario.carteira,
  })
  await page.getByRole('button', { name: 'Editar' }).first().click()
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Esta conta tem lançamentos e não pode ser excluída.')).toBeVisible()

  await page.goto('/configuracoes/categorias')
  await page.getByRole('button', { name: 'Nova' }).click()
  await page.getByLabel('Nova categoria').fill('Pets')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Categoria criada.')).toBeVisible()
  await expect(page.getByText('Pets')).toBeVisible()
})

test('dados de exemplo: carregar e limpar', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Carregar dados de exemplo' }).click()
  await expect(page.getByText('Dados de exemplo carregados.')).toBeVisible()
  expect(banco.linhas('gastos', usuario.id).length).toBeGreaterThan(5)
  expect(banco.linhas('dividas', usuario.id)).toHaveLength(3)

  await page.getByRole('link', { name: 'Gastos' }).click()
  await expect(page.getByText('Mercado (exemplo)')).toBeVisible()

  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Limpar dados de exemplo' }).click()
  await page.getByRole('button', { name: 'Apagar' }).click()
  await expect(page.getByText('Dados de exemplo apagados.')).toBeVisible()
  for (const tabela of ['gastos', 'receitas', 'dividas', 'projetos', 'cartoes'] as const) {
    expect(banco.linhas(tabela, usuario.id)).toHaveLength(0)
  }
})

test('excluir minha conta apaga tudo e volta para /entrar', async ({ page, banco }) => {
  await usuarioLogado(page, banco)
  await page.goto('/configuracoes')
  await page.getByRole('link', { name: 'Excluir minha conta' }).click()
  const botao = page.getByRole('button', { name: 'Excluir minha conta para sempre' })
  await expect(botao).toBeDisabled()
  await page.getByLabel('Para confirmar, digite EXCLUIR').fill('excluir')
  await botao.click()
  await expect(page).toHaveURL(/\/entrar$/)
  expect(banco.usuarios).toHaveLength(0)
  expect(banco.tabelas.contas).toHaveLength(0)
})

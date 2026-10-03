import { digitarValor, entrar, expect, test } from './fixtures'

test('sem sessão, a área interna manda para /entrar', async ({ page }) => {
  for (const rota of ['/', '/gastos', '/contas-a-pagar/nova', '/configuracoes']) {
    await page.goto(rota)
    await expect(page).toHaveURL(/\/entrar$/)
  }
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('cadastro com nome e termos leva ao primeiro acesso e depois ao Início', async ({
  page,
  banco,
}) => {
  await page.goto('/cadastro')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Diga como quer ser chamado(a).')).toBeVisible()
  await expect(page.getByText('Para criar a conta, aceite os termos')).toBeVisible()
  expect(banco.chamadas.filter((c) => c.caminho === '/auth/v1/signup')).toHaveLength(0)

  await page.getByLabel('Nome').fill('Ana Souza')
  await page.getByLabel('E-mail').fill('ana@exemplo.com')
  await page.getByLabel('Senha', { exact: true }).fill('segredo1')
  await page.getByLabel('Confirme a senha').fill('segredo1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Vamos começar' })).toBeVisible()
  await expect(page.getByLabel('Seu nome')).toHaveValue('Ana Souza')
  await digitarValor(page, /Saldo inicial/, '150000')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Previsão de desnecessários' })).toBeVisible()
  await digitarValor(page, 'Previsão mensal de desnecessários (R$)', '50000')
  await expect(page.getByLabel(/meta de receita/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Concluir' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Olá, Ana')).toBeVisible()
  await expect(page.getByText('R$ 1.500,00').first()).toBeVisible()

  const usuario = banco.usuarios[0]
  expect(usuario).toBeDefined()
  const uid = usuario?.id ?? ''
  expect(banco.linhas('profiles', uid)[0]).toMatchObject({
    nome: 'Ana Souza',
    onboarding_concluido: true,
    meta_desnecessario_centavos: 50000,
  })
  expect(banco.linhas('contas', uid)[0]).toMatchObject({ saldo_inicial_centavos: 150000 })
})

test('pular o primeiro acesso também libera o app', async ({ page, banco }) => {
  banco.criarUsuario('bia@exemplo.com', 'senha123', 'Bia')
  await entrar(page, 'bia@exemplo.com', 'senha123')
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: 'Pular por agora' }).click()
  await expect(page.getByText('Saldo total')).toBeVisible()
})

test('com confirmação de e-mail, o cadastro pede para conferir a caixa de entrada', async ({
  page,
  banco,
}) => {
  banco.confirmarEmail = true
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Caio')
  await page.getByLabel('E-mail').fill('caio@exemplo.com')
  await page.getByLabel('Senha', { exact: true }).fill('segredo1')
  await page.getByLabel('Confirme a senha').fill('segredo1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Enviamos um link de confirmação')).toBeVisible()
})

test('senha errada mostra mensagem; a certa entra e Sair volta para /entrar', async ({
  page,
  banco,
}) => {
  banco.criarUsuario('ana@exemplo.com', 'senha123', 'Ana', true)
  await entrar(page, 'ana@exemplo.com', 'errada')
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

  await page.getByLabel('Senha', { exact: true }).fill('senha123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Saldo total')).toBeVisible()

  // Sessão persiste ao recarregar e quem está logado não fica em /entrar.
  await page.reload()
  await expect(page.getByText('Saldo total')).toBeVisible()
  await page.goto('/entrar')
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/entrar$/)
})

test('esqueci a senha envia o link e os termos abrem sem login', async ({ page, banco }) => {
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  // Espera a tela nova: a de Entrar também tem um campo "E-mail".
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible()
  await page.getByLabel('E-mail').fill('ana@exemplo.com')
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByText('Link de recuperação enviado')).toBeVisible()
  expect(banco.chamadas.some((c) => c.caminho === '/auth/v1/recover')).toBe(true)

  await page.goto('/termos')
  await expect(page.getByRole('heading', { name: 'Termos de uso' })).toBeVisible()
  await page.goto('/privacidade')
  await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible()

  // Nova senha sem sessão: link inválido.
  await page.goto('/nova-senha')
  await expect(page.getByText('Link inválido ou expirado')).toBeVisible()
})

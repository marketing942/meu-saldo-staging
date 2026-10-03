import { hoje, mesAtual } from '@/lib/datas'
import { mesFatura } from '@/lib/regras/cartao'

import { digitarValor, expect, test, usuarioLogado } from './fixtures'

test('lança gasto no Pix em centavos e reaproveita a sugestão de categoria', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.getByRole('button', { name: 'Novo' }).click()
  await page.getByRole('link', { name: 'Gasto', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Novo gasto' })).toBeVisible()

  await page.getByRole('button', { name: 'Salvar gasto' }).click()
  await expect(page.getByText('Descreva o gasto.')).toBeVisible()

  await digitarValor(page, 'Valor (R$)', '4590')
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('45,90')
  await page.getByLabel('Descrição').fill('Mercado')
  await page.getByRole('button', { name: 'Alimentação' }).click()
  await page.getByRole('button', { name: 'Necessário', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar gasto' }).click()

  await expect(page.getByText('Gasto salvo.')).toBeVisible()
  const [gasto] = banco.linhas('gastos', usuario.id)
  expect(gasto).toMatchObject({
    descricao: 'Mercado',
    valor_centavos: 4590,
    origem: 'pix',
    conta_id: usuario.carteira,
    cartao_id: null,
    tipo: 'necessario',
    categoria_id: usuario.categoria('Alimentação'),
    data: hoje(),
  })
  expect(banco.linhas('aprendizado_categoria', usuario.id)).toHaveLength(1)

  // Mesma descrição: categoria e tipo vêm sugeridos.
  await page.goto('/gastos/novo')
  await page.getByLabel('Descrição').fill('  mercado ')
  await expect(page.getByText('Sugestão automática: Alimentação · Necessário')).toBeVisible()
  await digitarValor(page, 'Valor (R$)', '1000')
  await page.getByRole('button', { name: 'Salvar gasto' }).click()
  await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible()
  expect(banco.linhas('gastos', usuario.id)[1]).toMatchObject({
    valor_centavos: 1000,
    tipo: 'necessario',
    categoria_id: usuario.categoria('Alimentação'),
  })
})

test('compra parcelada no cartão: parcelas, fatura, pagamento e desfazer', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)

  await page.goto('/configuracoes/cartoes')
  await page.getByRole('button', { name: 'Cadastrar cartão' }).click()
  await page.getByLabel('Nome').fill('Nubank')
  await digitarValor(page, 'Limite (R$)', '500000')
  await page.getByLabel('Dia do fechamento').fill('5')
  await page.getByLabel('Dia do vencimento').fill('12')
  await page.getByRole('button', { name: 'Roxo' }).click()
  await page.getByRole('button', { name: 'Salvar cartão' }).click()
  await expect(page.getByText('Limite R$ 5.000,00 · fecha dia 5 · vence dia 12')).toBeVisible()
  const cartao = banco.linhas('cartoes', usuario.id)[0]
  expect(cartao).toMatchObject({ nome: 'Nubank', limite_centavos: 500000, cor: '#6F5AA8' })

  await page.goto('/gastos/novo')
  await page.getByRole('button', { name: 'Cartão', exact: true }).click()
  await expect(page.getByText('Disponível: R$ 5.000,00')).toBeVisible()
  await page.getByLabel('Parcelas').selectOption('3')
  await digitarValor(page, /Valor total/, '30001')
  await page.getByLabel('Descrição').fill('Tênis')
  await expect(page.getByText(/3x: 1ª de R\$ 100,01 e as demais de R\$ 100,00/)).toBeVisible()
  await page.getByRole('button', { name: 'Desnecessário' }).click()
  await page.getByRole('button', { name: 'Salvar gasto' }).click()
  await expect(page.getByText('Gasto salvo.')).toBeVisible()

  const parcelas = banco.linhas('gastos', usuario.id)
  expect(parcelas.map((p) => p.valor_centavos)).toEqual([10001, 10000, 10000])
  expect(new Set(parcelas.map((p) => p.grupo_parcelas)).size).toBe(1)
  expect(parcelas.every((p) => p.origem === 'cartao' && p.cartao_id === cartao?.id)).toBe(true)

  // Fatura em que a 1ª parcela entrou.
  const mes = mesFatura(hoje(), 5)
  await page.goto(`/cartoes/${cartao?.id}${mes === mesAtual() ? '' : `?mes=${mes}`}`)
  await expect(page.getByRole('heading', { name: 'Nubank' })).toBeVisible()
  await expect(page.getByText('R$ 100,01').first()).toBeVisible()
  await expect(page.getByText(/parcela 1\/3/)).toBeVisible()
  // A compra parcelada ocupa o limite inteiro (as 3 parcelas).
  await expect(page.getByText('R$ 300,01 · 6%')).toBeVisible()
  await expect(page.getByText('R$ 4.699,99')).toBeVisible()

  await page.getByRole('button', { name: 'Marcar fatura como paga' }).click()
  await expect(page.getByText('Fatura marcada como paga.')).toBeVisible()
  await expect(page.getByText('Paga', { exact: true })).toBeVisible()
  // Fatura paga devolve ao limite a parcela que estava nela.
  await expect(page.getByText('R$ 200,00 · 4%')).toBeVisible()
  expect(banco.linhas('faturas_pagas', usuario.id)[0]).toMatchObject({
    mes_ref: mes,
    conta_id: usuario.carteira,
  })

  await page.getByRole('button', { name: 'Desfazer pagamento' }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Marcar fatura como paga' })).toBeVisible()
  expect(banco.linhas('faturas_pagas', usuario.id)).toHaveLength(0)
  await expect(page.getByText('R$ 300,01 · 6%')).toBeVisible()

  // Editar compra parcelada só muda descrição, categoria e tipo (em todas as parcelas).
  await page.goto(`/gastos/${parcelas[0]?.id}`)
  await expect(page.getByText(/Compra parcelada em 3x/)).toBeVisible()
  await expect(page.getByLabel(/Valor/)).toBeDisabled()
  await page.getByLabel('Descrição').fill('Tênis de corrida')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Gasto atualizado.')).toBeVisible()
  expect(banco.linhas('gastos', usuario.id).every((p) => p.descricao === 'Tênis de corrida')).toBe(
    true,
  )
})

test('editar, filtrar e excluir com desfazer', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  const base = { origem: 'pix', conta_id: usuario.carteira, data: hoje() } as const
  banco.inserir(usuario.id, 'gastos', {
    ...base,
    descricao: 'Aluguel do mês',
    valor_centavos: 120000,
    tipo: 'necessario',
  })
  banco.inserir(usuario.id, 'gastos', {
    ...base,
    descricao: 'Pizza',
    valor_centavos: 6000,
    tipo: 'desnecessario',
  })

  await page.goto('/gastos')
  await expect(page.getByText('Aluguel do mês')).toBeVisible()
  await page.getByRole('button', { name: 'Desnecessário', exact: true }).click()
  await expect(page.getByText('Aluguel do mês')).toHaveCount(0)
  await expect(page.getByText('Pizza')).toBeVisible()
  await page.getByRole('button', { name: 'Todos' }).click()

  await page.getByRole('link', { name: /Aluguel do mês/ }).click()
  await digitarValor(page, 'Valor (R$)', '130000')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('R$ 1.300,00').first()).toBeVisible()

  await page.getByRole('link', { name: /Pizza/ }).click()
  await page.getByRole('button', { name: 'Excluir gasto' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Gasto excluído.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Pizza/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('link', { name: /Pizza/ })).toBeVisible()
  expect(banco.linhas('gastos', usuario.id).every((g) => g.deleted_at === null)).toBe(true)
})

test('receita entra no saldo e aparece na aba Gastos, em Receitas', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  await page.getByRole('button', { name: 'Novo' }).click()
  await page.getByRole('link', { name: 'Receita', exact: true }).click()
  await digitarValor(page, 'Valor (R$)', '300000')
  await page.getByLabel('Descrição').fill('Salário')
  await page.getByRole('button', { name: 'Salvar receita' }).click()
  await expect(page.getByText('Receita salva.')).toBeVisible()
  expect(banco.linhas('receitas', usuario.id)[0]).toMatchObject({
    valor_centavos: 300000,
    conta_id: usuario.carteira,
  })
  await expect(page.getByText('R$ 3.000,00').first()).toBeVisible()

  await page.getByRole('link', { name: 'Gastos', exact: true }).click()
  await page.getByRole('button', { name: 'Receitas', exact: true }).click()
  await expect(page).toHaveURL(/\/gastos\?aba=receitas$/)
  await expect(page.getByRole('heading', { name: 'Receitas', level: 1 })).toBeVisible()

  // Editar e excluir com desfazer, a partir da lista de receitas.
  await page.getByRole('link', { name: /Salário/ }).click()
  await digitarValor(page, 'Valor (R$)', '320000')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page).toHaveURL(/\/gastos\?aba=receitas$/)
  await expect(page.getByText('+ R$ 3.200,00')).toBeVisible()

  await page.getByRole('link', { name: /Salário/ }).click()
  await page.getByRole('button', { name: 'Excluir receita' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Receita excluída.')).toBeVisible()
  await expect(page.getByText('Nenhuma receita neste mês')).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('link', { name: /Salário/ })).toBeVisible()
})

test('limite do cartão: disponível no formulário, compra acima do limite e excluir com desfazer', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  const cartao = banco.inserir(usuario.id, 'cartoes', {
    nome: 'Visa',
    limite_centavos: 10000,
    dia_fechamento: 5,
    dia_vencimento: 12,
  })

  await page.goto('/gastos/novo')
  await page.getByRole('button', { name: 'Cartão', exact: true }).click()
  await expect(page.getByText('Disponível: R$ 100,00')).toBeVisible()
  await digitarValor(page, 'Valor (R$)', '15000')
  await page.getByLabel('Descrição').fill('Celular')
  await page.getByRole('button', { name: 'Necessário', exact: true }).click()
  await expect(page.getByText('Esta compra passa do limite disponível (R$ 100,00)')).toBeVisible()

  // Sem confirmar, não salva.
  await page.getByRole('button', { name: 'Salvar gasto' }).click()
  await expect(page.getByText('Confirme que quer salvar a compra acima do limite.')).toBeVisible()
  expect(banco.linhas('gastos', usuario.id)).toHaveLength(0)

  await page.getByLabel('Salvar mesmo assim').check()
  await page.getByRole('button', { name: 'Salvar gasto' }).click()
  await expect(page.getByText('Gasto salvo.')).toBeVisible()
  expect(banco.limiteCartao(usuario.id, cartao.id)).toMatchObject({
    usado_centavos: 15000,
    disponivel_centavos: -5000,
  })

  // Início: limite no carrossel e alerta de limite estourado.
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.getByText('Limite do Visa estourado')).toBeVisible()
  await expect(page.getByText('R$ 150,00 · 150%')).toBeVisible()

  // Excluir devolve o limite na hora; desfazer volta a ocupar.
  await page.getByRole('link', { name: 'Gastos', exact: true }).click()
  await page.getByRole('link', { name: /Celular/ }).click()
  await page.getByRole('button', { name: 'Excluir gasto' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Gasto excluído.')).toBeVisible()
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.getByText('R$ 0,00 · 0%')).toBeVisible()
  await expect(page.getByText('Limite do Visa estourado')).toHaveCount(0)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('Limite do Visa estourado')).toBeVisible()
  expect(banco.limiteCartao(usuario.id, cartao.id)?.usado_centavos).toBe(15000)
})

test('navegação por mês troca o mês da tela e mantém ao trocar de aba', async ({ page, banco }) => {
  await usuarioLogado(page, banco)
  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(page.getByText('previsto')).toBeVisible()
  await expect(page).toHaveURL(/\?mes=\d{4}-\d{2}$/)
  await page.getByRole('link', { name: 'Gastos', exact: true }).click()
  await expect(page).toHaveURL(/\/gastos\?mes=\d{4}-\d{2}$/)
  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(page.getByText('mês atual')).toBeVisible()
  await expect(page).toHaveURL(/\/gastos$/)
})

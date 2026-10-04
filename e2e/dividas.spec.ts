import { diaDe, hoje, mesAdd, mesAtual } from '@/lib/datas'

import { digitarValor, expect, test, usuarioLogado } from './fixtures'

test('conta a pagar parcelada: prévia, marcar como paga, desfazer e mês seguinte', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  // Na aba inferior o rótulo é curto; a tela tem o nome completo.
  await page.getByRole('link', { name: 'A pagar', exact: true }).click()
  await expect(page).toHaveURL(/\/contas-a-pagar$/)
  await expect(page.getByRole('heading', { name: 'Contas a pagar', level: 1 })).toBeVisible()
  await expect(page.getByText('Nenhuma conta a pagar neste mês')).toBeVisible()
  await page.getByRole('link', { name: 'Nova conta a pagar' }).click()
  await expect(page.getByRole('heading', { name: 'Nova conta a pagar' })).toBeVisible()

  await page.getByLabel('Nome').fill('Financiamento do carro')
  await digitarValor(page, 'Valor da parcela (R$)', '89000')
  await page.getByLabel('Dia do venc.').fill('28')
  await page.getByLabel('Total de parcelas').fill('48')
  await page.getByLabel('Já paguei').fill('12')
  await expect(page.getByText('Restam 36 parcelas · saldo devedor R$ 32.040,00')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar conta a pagar' }).click()

  await expect(page.getByText('Conta a pagar salva.')).toBeVisible()
  expect(banco.linhas('dividas', usuario.id)[0]).toMatchObject({
    nome: 'Financiamento do carro',
    valor_parcela_centavos: 89000,
    total_parcelas: 48,
    parcelas_ja_pagas: 12,
    forma_pagamento: 'conta',
    conta_id: usuario.carteira,
    infinita: false,
  })
  await expect(page.getByText('parcela 13/48')).toBeVisible()
  await expect(page.getByText(/Restam 35 parcelas depois desta/)).toBeVisible()

  await page.getByRole('button', { name: 'Marcar como paga' }).click()
  await expect(page.getByText('Parcela marcada como paga.')).toBeVisible()
  await expect(page.getByText(/^Paga em \d{2}\/\d{2}\/\d{4}$/)).toBeVisible()
  expect(banco.linhas('dividas_pagamentos', usuario.id)[0]).toMatchObject({
    mes_ref: mesAtual(),
    valor_centavos: 89000,
  })

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('button', { name: 'Marcar como paga' })).toBeVisible()
  expect(banco.linhas('dividas_pagamentos', usuario.id)).toHaveLength(0)

  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(page).toHaveURL(new RegExp(`mes=${mesAdd(mesAtual(), 1)}`))
  await expect(page.getByText('parcela 14/48')).toBeVisible()
})

test('recorrente: aparece todo mês, soma assinaturas e pode ser excluída com desfazer', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/contas-a-pagar/nova')
  await page.getByRole('button', { name: 'Recorrente ∞' }).click()
  await page.getByLabel('Nome').fill('Streaming')
  await page.getByLabel('Categoria da conta a pagar').selectOption('assinatura')
  await digitarValor(page, 'Valor da parcela (R$)', '3990')
  await page.getByLabel('Dia do venc.').fill('20')
  await page.getByRole('button', { name: 'Salvar conta a pagar' }).click()

  await expect(page.getByText('∞ recorrente')).toBeVisible()
  await expect(page.getByText('R$ 39,90/mês · R$ 478,80/ano')).toBeVisible()
  expect(banco.linhas('dividas', usuario.id)[0]).toMatchObject({
    infinita: true,
    total_parcelas: null,
    parcelas_ja_pagas: 0,
  })

  await page.goto(`/contas-a-pagar?mes=${mesAdd(mesAtual(), 3)}`)
  await expect(page.getByText('Streaming')).toBeVisible()

  await page.getByRole('link', { name: 'Streaming' }).click()
  await expect(page.getByRole('heading', { name: 'Editar conta a pagar' })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir conta a pagar' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Conta excluída de todos os meses.')).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('Streaming')).toBeVisible()
})

test('Início mostra o total de contas a pagar e os próximos vencimentos', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  banco.inserir(usuario.id, 'dividas', {
    nome: 'Aluguel',
    tipo: 'aluguel',
    valor_parcela_centavos: 150000,
    dia_vencimento: 28,
    infinita: true,
    forma_pagamento: 'conta',
    conta_id: usuario.carteira,
  })
  await page.reload()
  await expect(page.getByText(/^Total de contas a pagar em [a-zç]+$/)).toBeVisible()
  await expect(page.getByText('Próximos vencimentos')).toBeVisible()
  await expect(page.getByText('R$ 1.500,00').first()).toBeVisible()
})

test('alerta de conta a pagar que vence hoje', async ({ page, banco }) => {
  const usuario = await usuarioLogado(page, banco)
  banco.inserir(usuario.id, 'dividas', {
    nome: 'Internet',
    tipo: 'assinatura',
    valor_parcela_centavos: 9990,
    dia_vencimento: diaDe(hoje()),
    infinita: true,
    forma_pagamento: 'conta',
    conta_id: usuario.carteira,
  })
  await page.reload()
  await expect(page.getByText('Conta a pagar vence hoje')).toBeVisible()
  await expect(page.getByText('Internet: R$ 99,90.')).toBeVisible()
  await page.getByRole('link', { name: 'Ver contas a pagar' }).click()
  await expect(page).toHaveURL(/\/contas-a-pagar$/)
})

test('conta a pagar no cartão compromete o limite na hora e libera a cada parcela paga', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  const cartao = banco.inserir(usuario.id, 'cartoes', {
    nome: 'Nubank',
    limite_centavos: 400000,
    dia_fechamento: 10,
    dia_vencimento: 20,
  })
  const limite = () => banco.limiteCartao(usuario.id, cartao.id)

  await page.goto('/contas-a-pagar/nova')
  await page.getByLabel('Nome').fill('Notebook')
  await digitarValor(page, 'Valor da parcela (R$)', '10000')
  await page.getByLabel('Dia do venc.').fill('15')
  await page.getByLabel('Total de parcelas').fill('12')
  await page.getByRole('button', { name: 'Cartão de crédito' }).click()
  await expect(page.getByLabel('Cartão', { exact: true })).toHaveValue(cartao.id)
  await expect(page.getByText('Limite disponível hoje: R$ 4.000,00')).toBeVisible()
  await expect(page.getByText('Esta conta comprometerá: R$ 1.200,00')).toBeVisible()
  await expect(page.getByText('Disponível após lançamento: R$ 2.800,00')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar conta a pagar' }).click()
  await expect(page.getByText('Conta a pagar salva.')).toBeVisible()
  expect(limite()).toMatchObject({ usado_centavos: 120000, disponivel_centavos: 280000 })

  // Início: o card do cartão mostra a fatura e, separado, o limite comprometido.
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.getByText('R$ 1.200,00 · 30%')).toBeVisible()
  await expect(page.getByText('R$ 2.800,00').first()).toBeVisible()

  // Marcar a parcela do mês como paga libera R$ 100,00.
  await page.getByRole('link', { name: 'A pagar', exact: true }).click()
  await page.getByRole('button', { name: 'Marcar como paga' }).click()
  await expect(page.getByText('Parcela marcada como paga.')).toBeVisible()
  expect(limite()).toMatchObject({ usado_centavos: 110000, disponivel_centavos: 290000 })
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.getByText('R$ 1.100,00 · 28%')).toBeVisible()

  // Alterar o valor recalcula: o que a conta já ocupa volta antes de comparar.
  await page.getByRole('link', { name: 'A pagar', exact: true }).click()
  await page.getByRole('link', { name: 'Notebook' }).click()
  await expect(page.getByText('Limite disponível hoje: R$ 2.900,00')).toBeVisible()
  await expect(page.getByText('Esta conta comprometerá: R$ 1.100,00')).toBeVisible()
  await digitarValor(page, 'Valor da parcela (R$)', '12000')
  await expect(page.getByText('Esta conta comprometerá: R$ 1.320,00')).toBeVisible()
  await expect(page.getByText('Disponível após salvar: R$ 2.680,00')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Conta a pagar atualizada.')).toBeVisible()
  expect(limite()?.usado_centavos).toBe(132000)

  // Excluir devolve todo o limite.
  await page.getByRole('link', { name: 'Notebook' }).click()
  await page.getByRole('button', { name: 'Excluir conta a pagar' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Conta excluída de todos os meses.')).toBeVisible()
  await expect.poll(() => limite()?.usado_centavos).toBe(0)
  expect(limite()?.disponivel_centavos).toBe(400000)
})

test('conta a pagar acima do limite do cartão só salva com confirmação', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  const cartao = banco.inserir(usuario.id, 'cartoes', {
    nome: 'Visa',
    limite_centavos: 100000,
    dia_fechamento: 5,
    dia_vencimento: 12,
  })

  await page.goto('/contas-a-pagar/nova')
  await page.getByLabel('Nome').fill('Sofá')
  await digitarValor(page, 'Valor da parcela (R$)', '10000')
  await page.getByLabel('Dia do venc.').fill('10')
  await page.getByLabel('Total de parcelas').fill('12')
  await page.getByRole('button', { name: 'Cartão de crédito' }).click()
  await expect(page.getByText(/^Disponível após lançamento: .R\$ 200,00$/)).toBeVisible()
  await expect(page.getByText('Esta conta passa do limite disponível (R$ 1.000,00)')).toBeVisible()

  await page.getByRole('button', { name: 'Salvar conta a pagar' }).click()
  await expect(page.getByText('Confirme que quer salvar a conta acima do limite.')).toBeVisible()
  expect(banco.linhas('dividas', usuario.id)).toHaveLength(0)

  await page.getByLabel('Salvar mesmo assim').check()
  await page.getByRole('button', { name: 'Salvar conta a pagar' }).click()
  await expect(page.getByText('Conta a pagar salva.')).toBeVisible()
  expect(banco.linhas('dividas', usuario.id)[0]).toMatchObject({
    forma_pagamento: 'cartao',
    cartao_id: cartao.id,
    conta_id: null,
  })
  expect(banco.limiteCartao(usuario.id, cartao.id)).toMatchObject({
    usado_centavos: 120000,
    disponivel_centavos: -20000,
  })
})

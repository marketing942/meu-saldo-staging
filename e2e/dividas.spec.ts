import { mesAdd, mesAtual } from '@/lib/datas'

import { digitarValor, expect, test, usuarioLogado } from './fixtures'

test('dívida parcelada: prévia, marcar como paga, desfazer e mês seguinte', async ({
  page,
  banco,
}) => {
  const usuario = await usuarioLogado(page, banco)
  await page.goto('/dividas')
  await expect(page.getByText('Nenhuma dívida neste mês')).toBeVisible()
  await page.getByRole('link', { name: 'Nova dívida' }).click()

  await page.getByLabel('Nome').fill('Financiamento do carro')
  await digitarValor(page, 'Valor da parcela (R$)', '89000')
  await page.getByLabel('Dia do venc.').fill('28')
  await page.getByLabel('Total de parcelas').fill('48')
  await page.getByLabel('Já paguei').fill('12')
  await expect(page.getByText('Restam 36 parcelas · saldo devedor R$ 32.040,00')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar dívida' }).click()

  await expect(page.getByText('Dívida salva.')).toBeVisible()
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
  await page.goto('/dividas/nova')
  await page.getByRole('button', { name: 'Recorrente ∞' }).click()
  await page.getByLabel('Nome').fill('Streaming')
  await page.getByLabel('Categoria da dívida').selectOption('assinatura')
  await digitarValor(page, 'Valor da parcela (R$)', '3990')
  await page.getByLabel('Dia do venc.').fill('20')
  await page.getByRole('button', { name: 'Salvar dívida' }).click()

  await expect(page.getByText('∞ recorrente')).toBeVisible()
  await expect(page.getByText('R$ 39,90/mês · R$ 478,80/ano')).toBeVisible()
  expect(banco.linhas('dividas', usuario.id)[0]).toMatchObject({
    infinita: true,
    total_parcelas: null,
    parcelas_ja_pagas: 0,
  })

  await page.goto(`/dividas?mes=${mesAdd(mesAtual(), 3)}`)
  await expect(page.getByText('Streaming')).toBeVisible()

  await page.getByRole('link', { name: 'Streaming' }).click()
  await page.getByRole('button', { name: 'Excluir dívida' }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Dívida excluída de todos os meses.')).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('Streaming')).toBeVisible()
})

test('Início mostra o total de dívidas e os próximos vencimentos', async ({ page, banco }) => {
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
  await expect(page.getByText('Dívidas do mês')).toBeVisible()
  await expect(page.getByText('Próximos vencimentos')).toBeVisible()
  await expect(page.getByText('R$ 1.500,00').first()).toBeVisible()
})

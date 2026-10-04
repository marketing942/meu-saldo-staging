import { describe, expect, it } from 'vitest'

import { mesAdd } from '@/lib/datas'

import {
  type ContaAPagarNoCartao,
  type LancamentoLimite,
  comprometidoPorContasAPagar,
  disponivelDepoisDaConta,
  excessoNoLimite,
  faturaQueVenceNoMes,
  fechamentoFatura,
  gerarParcelas,
  limiteCartao,
  limiteUsado,
  mesFatura,
  statusFatura,
  vencimentoFatura,
} from './cartao'

describe('fatura e fechamento', () => {
  it('compra no dia do fechamento entra na fatura do mês', () => {
    expect(mesFatura('2026-10-10', 10)).toBe('2026-10')
  })

  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(mesFatura('2026-10-11', 10)).toBe('2026-11')
  })

  it('a fatura seguinte vira o ano', () => {
    expect(mesFatura('2026-12-15', 10)).toBe('2027-01')
  })

  it('fechamento no dia 31 em fevereiro fecha no último dia', () => {
    expect(mesFatura('2027-02-28', 31)).toBe('2027-02')
    expect(fechamentoFatura('2027-02', 31)).toBe('2027-02-28')
  })

  it('vencimento antes do fechamento cai no mês seguinte', () => {
    expect(vencimentoFatura('2026-10', 25, 5)).toBe('2026-11-05')
    expect(faturaQueVenceNoMes('2026-11', 25, 5)).toBe('2026-10')
  })

  it('vencimento depois do fechamento cai no mesmo mês', () => {
    expect(vencimentoFatura('2026-10', 3, 10)).toBe('2026-10-10')
    expect(faturaQueVenceNoMes('2026-10', 3, 10)).toBe('2026-10')
  })

  it('status: aberta até o fechamento, fechada depois, paga quando marcada', () => {
    expect(statusFatura('2026-10', 10, false, '2026-10-10')).toBe('aberta')
    expect(statusFatura('2026-10', 10, false, '2026-10-11')).toBe('fechada')
    expect(statusFatura('2026-10', 10, true, '2026-10-11')).toBe('paga')
  })
})

describe('geração de parcelas', () => {
  it('uma por mês, dia ajustado em meses curtos, resto na primeira', () => {
    expect(gerarParcelas(10000, '2026-10-31', 3)).toEqual([
      { parcela: 1, data: '2026-10-31', valorCentavos: 3334 },
      { parcela: 2, data: '2026-11-30', valorCentavos: 3333 },
      { parcela: 3, data: '2026-12-31', valorCentavos: 3333 },
    ])
  })

  it('31/01 em 2x cai em 28/02', () => {
    expect(gerarParcelas(5000, '2027-01-31', 2).map((p) => p.data)).toEqual([
      '2027-01-31',
      '2027-02-28',
    ])
  })

  it('29/02 em ano bissexto mantém o dia nos meses seguintes', () => {
    expect(gerarParcelas(3000, '2028-01-29', 3).map((p) => p.data)).toEqual([
      '2028-01-29',
      '2028-02-29',
      '2028-03-29',
    ])
  })

  it('a soma das parcelas é exatamente o total', () => {
    const parcelas = gerarParcelas(99999, '2026-10-15', 12)
    expect(parcelas).toHaveLength(12)
    expect(parcelas.reduce((s, p) => s + p.valorCentavos, 0)).toBe(99999)
  })

  it('à vista gera uma parcela', () => {
    expect(gerarParcelas(1990, '2026-10-03', 1)).toEqual([
      { parcela: 1, data: '2026-10-03', valorCentavos: 1990 },
    ])
  })

  it('recusa mais de 12 parcelas ou valor menor que o número de parcelas', () => {
    expect(() => gerarParcelas(10000, '2026-10-15', 13)).toThrow()
    expect(() => gerarParcelas(10000, '2026-10-15', 0)).toThrow()
    expect(() => gerarParcelas(2, '2026-10-15', 3)).toThrow()
  })
})

describe('limite do cartão', () => {
  const nenhumaPaga = new Set<string>()

  /** Uma linha por parcela, na fatura em que cada uma entra (fecha dia 10). */
  function parcelas(total: number, data: string, n: number) {
    return gerarParcelas(total, data, n).map((p) => ({
      valorCentavos: p.valorCentavos,
      faturaMesRef: mesFatura(p.data, 10),
    }))
  }

  it('soma o que está em faturas não pagas, incluindo parcelas futuras', () => {
    const lancamentos = [
      { valorCentavos: 10000, faturaMesRef: '2026-10' },
      { valorCentavos: 5000, faturaMesRef: '2026-10' },
      { valorCentavos: 10000, faturaMesRef: '2026-11' },
      { valorCentavos: 5000, faturaMesRef: '2026-11' },
      { valorCentavos: 10000, faturaMesRef: '2026-12' },
    ]
    expect(limiteUsado(lancamentos, new Set(['2026-10']))).toBe(25000)
  })

  it('compra à vista consome o valor total', () => {
    expect(limiteCartao(200000, parcelas(40000, '2026-10-15', 1), nenhumaPaga)).toEqual({
      limiteCentavos: 200000,
      usadoCentavos: 40000,
      disponivelCentavos: 160000,
      percentual: 20,
    })
  })

  it('compra parcelada consome todas as parcelas, inclusive as de meses futuros', () => {
    const celular = parcelas(80000, '2026-10-15', 4)
    expect(celular.map((p) => p.faturaMesRef)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(limiteCartao(200000, celular, nenhumaPaga).usadoCentavos).toBe(80000)
  })

  it('conta a pagar no cartão consome só a parcela do mês, na fatura em que entra', () => {
    // Assinatura de R$ 50,00 paga em outubro e em novembro (vence dia 1, fecha dia 10).
    const assinatura = [
      { valorCentavos: 5000, faturaMesRef: mesFatura('2026-10-01', 10) },
      { valorCentavos: 5000, faturaMesRef: mesFatura('2026-11-01', 10) },
    ]
    expect(limiteCartao(200000, assinatura, nenhumaPaga).usadoCentavos).toBe(10000)
    expect(limiteCartao(200000, assinatura, new Set(['2026-10'])).usadoCentavos).toBe(5000)
  })

  it('marcar a fatura como paga devolve o valor dela ao limite', () => {
    const lancamentos = [...parcelas(30000, '2026-10-05', 3), ...parcelas(5000, '2026-10-11', 1)]
    expect(limiteCartao(200000, lancamentos, nenhumaPaga).usadoCentavos).toBe(35000)
    // Fatura de outubro: parcela 1/3 (10000).
    expect(limiteCartao(200000, lancamentos, new Set(['2026-10'])).usadoCentavos).toBe(25000)
    // Outubro e novembro pagas: sobra a parcela 3/3 de dezembro.
    expect(
      limiteCartao(200000, lancamentos, new Set(['2026-10', '2026-11'])).disponivelCentavos,
    ).toBe(190000)
  })

  it('excluir devolve o limite na hora e desfazer volta a consumir', () => {
    const tv = { valorCentavos: 40000, faturaMesRef: '2026-11' }
    const mercado = { valorCentavos: 10000, faturaMesRef: '2026-11' }
    expect(limiteCartao(200000, [tv, mercado], nenhumaPaga).usadoCentavos).toBe(50000)
    expect(
      limiteCartao(200000, [{ ...tv, excluido: true }, mercado], nenhumaPaga).usadoCentavos,
    ).toBe(10000)
    expect(
      limiteCartao(200000, [{ ...tv, excluido: false }, mercado], nenhumaPaga).usadoCentavos,
    ).toBe(50000)
  })

  it('percentual com duas casas e disponível negativo quando passa do limite', () => {
    expect(
      limiteCartao(300000, [{ valorCentavos: 100000, faturaMesRef: '2026-11' }], nenhumaPaga)
        .percentual,
    ).toBe(33.33)
    expect(
      limiteCartao(100000, [{ valorCentavos: 120000, faturaMesRef: '2026-11' }], nenhumaPaga),
    ).toMatchObject({ disponivelCentavos: -20000, percentual: 120 })
  })

  it('excesso da compra sobre o disponível (na edição, o valor antigo volta antes)', () => {
    expect(excessoNoLimite(30000, 25000)).toBe(0)
    expect(excessoNoLimite(30000, 30000)).toBe(0)
    expect(excessoNoLimite(30000, 45000)).toBe(15000)
    expect(excessoNoLimite(30000, 45000, 20000)).toBe(0)
    expect(excessoNoLimite(-5000, 1000)).toBe(6000)
  })
})

describe('contas a pagar no cartão comprometem o limite', () => {
  const NUBANK = 'nubank'
  const VISA = 'visa'
  const HOJE = '2026-10'
  const semCompras: LancamentoLimite[] = []
  const nenhumaPaga = new Set<string>()

  function conta(parcial: Partial<ContaAPagarNoCartao> = {}): ContaAPagarNoCartao {
    return {
      infinita: false,
      totalParcelas: 12,
      parcelasJaPagas: 0,
      mesInicioRef: HOJE,
      diaVencimento: 15,
      valorParcelaCentavos: 10000,
      ativa: true,
      formaPagamento: 'cartao',
      cartaoId: NUBANK,
      excluida: false,
      mesesPagos: [],
      ...parcial,
    }
  }

  function limiteNubank(
    contas: ContaAPagarNoCartao[],
    compras: LancamentoLimite[] = semCompras,
    pagas: ReadonlySet<string> = nenhumaPaga,
  ) {
    return limiteCartao(400000, compras, pagas, comprometidoPorContasAPagar(NUBANK, contas, HOJE))
  }

  it('A: limite 400000 e conta de 120000 → usado 120000, disponível 280000', () => {
    expect(limiteNubank([conta()])).toEqual({
      limiteCentavos: 400000,
      usadoCentavos: 120000,
      disponivelCentavos: 280000,
      percentual: 30,
    })
  })

  it('B: depois de pagar uma parcela de 10000 → usado 110000, disponível 290000', () => {
    expect(limiteNubank([conta({ mesesPagos: ['2026-10'] })])).toMatchObject({
      usadoCentavos: 110000,
      disponivelCentavos: 290000,
    })
  })

  it('C: excluir a conta restante → usado 0, disponível 400000 (desfazer volta)', () => {
    const paga = conta({ mesesPagos: ['2026-10'] })
    expect(limiteNubank([{ ...paga, excluida: true }])).toMatchObject({
      usadoCentavos: 0,
      disponivelCentavos: 400000,
    })
    expect(limiteNubank([{ ...paga, excluida: false }]).usadoCentavos).toBe(110000)
  })

  it('D: duas contas no mesmo cartão somam', () => {
    const celular = conta({ totalParcelas: 6, valorParcelaCentavos: 5000 })
    expect(limiteNubank([conta(), celular])).toMatchObject({
      usadoCentavos: 150000,
      disponivelCentavos: 250000,
    })
  })

  it('E: contas de cartões diferentes nunca se misturam', () => {
    const contas = [conta(), conta({ cartaoId: VISA, totalParcelas: 3 })]
    expect(comprometidoPorContasAPagar(NUBANK, contas, HOJE)).toBe(120000)
    expect(comprometidoPorContasAPagar(VISA, contas, HOJE)).toBe(30000)
    // Conta paga na carteira nunca entra no limite, mesmo com um cartão antigo gravado.
    expect(comprometidoPorContasAPagar(NUBANK, [conta({ formaPagamento: 'conta' })], HOJE)).toBe(0)
  })

  it('F: compra parcelada — a fatura do mês é diferente do limite comprometido', () => {
    const compra = gerarParcelas(120000, '2026-10-05', 12).map((p) => ({
      valorCentavos: p.valorCentavos,
      faturaMesRef: mesFatura(p.data, 10),
    }))
    const faturaDeOutubro = compra
      .filter((p) => p.faturaMesRef === '2026-10')
      .reduce((s, p) => s + p.valorCentavos, 0)
    expect(faturaDeOutubro).toBe(10000)
    expect(limiteNubank([], compra).usadoCentavos).toBe(120000)
    // Fatura de outubro paga: só ela sai do limite.
    expect(limiteNubank([], compra, new Set(['2026-10'])).usadoCentavos).toBe(110000)
  })

  it('compra e conta a pagar no mesmo cartão somam sem contar nada duas vezes', () => {
    const compra = [{ valorCentavos: 30000, faturaMesRef: '2026-11' }]
    expect(limiteNubank([conta({ mesesPagos: ['2026-10'] })], compra).usadoCentavos).toBe(140000)
  })

  it('formulário: disponível depois da conta (nova e editada no mesmo cartão)', () => {
    expect(disponivelDepoisDaConta(400000, 120000)).toBe(280000)
    // Editar de 120000 para 150000 no mesmo cartão: só a diferença sai do disponível.
    expect(disponivelDepoisDaConta(280000, 150000, 120000)).toBe(250000)
    expect(disponivelDepoisDaConta(10000, 30000)).toBe(-20000)
  })

  it('2: sem pagamentos, o usado continua 120000 mesmo com meses passando', () => {
    for (const mes of ['2026-10', '2026-11', '2027-01', '2027-09']) {
      expect(comprometidoPorContasAPagar(NUBANK, [conta()], mes)).toBe(120000)
    }
  })

  it('E: editar a conta de 1.200,00 para 1.500,00 reflete 1.500,00 no usado', () => {
    expect(limiteNubank([conta({ valorParcelaCentavos: 12500 })])).toMatchObject({
      usadoCentavos: 150000,
      disponivelCentavos: 250000,
    })
  })

  it('quitar todas as parcelas devolve todo o limite', () => {
    const meses = Array.from({ length: 12 }, (_, i) => mesAdd(HOJE, i))
    expect(limiteNubank([conta({ mesesPagos: meses })])).toMatchObject({
      usadoCentavos: 0,
      disponivelCentavos: 400000,
    })
  })

  it('7: a parcela paga vai para a fatura, mas não volta a contar no limite', () => {
    // A fatura soma a parcela paga (10000); o limite só recebe compras (gastos)
    // e o saldo devedor da conta, que já não tem essa parcela.
    const paga = conta({ mesesPagos: ['2026-10'] })
    const faturaComAParcela = 10000
    expect(faturaComAParcela).toBe(paga.valorParcelaCentavos)
    expect(limiteNubank([paga]).usadoCentavos).toBe(110000)
    expect(limiteNubank([paga]).usadoCentavos).not.toBe(110000 + faturaComAParcela)
  })
})

import { describe, expect, it } from 'vitest'

import {
  faturaQueVenceNoMes,
  fechamentoFatura,
  gerarParcelas,
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
})

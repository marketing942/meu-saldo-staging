import { describe, expect, it } from 'vitest'

import {
  alertaDesnecessarios,
  diasDoMes,
  nivelDoPercentual,
  podeGastarPorDia,
  progressoMetaReceita,
  progressoProjeto,
  sobraNoMes,
  totaisGastosDoMes,
} from './resumo'

describe('dias do mês', () => {
  it('mês atual: conta hoje nos dias restantes', () => {
    expect(diasDoMes('2026-10', '2026-10-03')).toEqual({
      situacao: 'atual',
      diasNoMes: 31,
      diasPassados: 3,
      diasRestantes: 29,
      dataReferencia: '2026-10-03',
    })
  })

  it('mês passado e futuro', () => {
    expect(diasDoMes('2026-09', '2026-10-03')).toMatchObject({
      situacao: 'passado',
      diasRestantes: 0,
      dataReferencia: '2026-09-30',
    })
    expect(diasDoMes('2026-11', '2026-10-03')).toMatchObject({
      situacao: 'futuro',
      diasRestantes: 30,
      dataReferencia: '2026-10-31',
    })
  })
})

describe('gastos do mês', () => {
  it('pela data da compra, sem excluídos', () => {
    const gastos = [
      { valorCentavos: 10000, data: '2026-10-03', tipo: 'necessario' as const, excluido: false },
      { valorCentavos: 75000, data: '2026-10-01', tipo: 'desnecessario' as const, excluido: false },
      { valorCentavos: 10000, data: '2026-11-05', tipo: 'necessario' as const, excluido: false },
      { valorCentavos: 7777, data: '2026-10-02', tipo: 'necessario' as const, excluido: true },
    ]
    expect(totaisGastosDoMes(gastos, '2026-10')).toEqual({
      totalCentavos: 85000,
      necessarioCentavos: 10000,
      desnecessarioCentavos: 75000,
    })
  })
})

describe('pode gastar por dia', () => {
  it('(saldo − dívidas pendentes) ÷ dias restantes, para baixo', () => {
    expect(podeGastarPorDia(417000, 20000, 29)).toBe(13689)
    expect(podeGastarPorDia(416000, 55000, 30)).toBe(12033)
  })

  it('mínimo de 1 dia e nada em meses passados', () => {
    expect(podeGastarPorDia(1000, 0, 1)).toBe(1000)
    expect(podeGastarPorDia(1000, 0, 0)).toBeNull()
  })

  it('fica negativo quando as dívidas passam do saldo', () => {
    expect(podeGastarPorDia(1000, 3000, 2)).toBe(-1000)
  })

  it('sobra no mês desconta dívidas e faturas pendentes', () => {
    expect(sobraNoMes(416000, 55000, 15000)).toBe(346000)
  })
})

describe('meta de desnecessários', () => {
  it('faixas: verde < 70%, ocre 70–89%, alerta forte 90–99%, rosado >= 100%', () => {
    expect(nivelDoPercentual(69.99)).toBe('ok')
    expect(nivelDoPercentual(70)).toBe('atencao')
    expect(nivelDoPercentual(89.99)).toBe('atencao')
    expect(nivelDoPercentual(90)).toBe('forte')
    expect(nivelDoPercentual(99.99)).toBe('forte')
    expect(nivelDoPercentual(100)).toBe('estourou')
    expect(nivelDoPercentual(null)).toBe('sem-meta')
  })

  it('75% da meta e projeção passando em ~1 dia (cenário do SQL)', () => {
    expect(
      alertaDesnecessarios({
        desnecessarioCentavos: 75000,
        metaCentavos: 100000,
        situacao: 'atual',
        diasPassados: 3,
        diasNoMes: 31,
      }),
    ).toEqual({
      nivel: 'atencao',
      percentual: 75,
      excedenteCentavos: 0,
      projecaoCentavos: 775000,
      diasParaEstourar: 1,
    })
  })

  it('ritmo com dízima: conta exata, sem dia a mais', () => {
    // R$ 400 em 3 dias, meta R$ 800: faltam R$ 400 a R$ 133,33/dia = exatamente 3 dias.
    // Dividir pelo ritmo já arredondado dava 4 (por isso a migration 20261004090000).
    const alerta = alertaDesnecessarios({
      desnecessarioCentavos: 40000,
      metaCentavos: 80000,
      situacao: 'atual',
      diasPassados: 3,
      diasNoMes: 31,
    })
    expect(alerta.diasParaEstourar).toBe(3)
    expect(alerta.projecaoCentavos).toBe(413333)
  })

  it('não projeta quando o ritmo não passa da meta', () => {
    const alerta = alertaDesnecessarios({
      desnecessarioCentavos: 1000,
      metaCentavos: 100000,
      situacao: 'atual',
      diasPassados: 10,
      diasNoMes: 30,
    })
    expect(alerta.projecaoCentavos).toBe(3000)
    expect(alerta.diasParaEstourar).toBeNull()
  })

  it('ultrapassou: mostra o excedente; meses fechados não projetam', () => {
    const alerta = alertaDesnecessarios({
      desnecessarioCentavos: 112000,
      metaCentavos: 100000,
      situacao: 'passado',
      diasPassados: 30,
      diasNoMes: 30,
    })
    expect(alerta).toMatchObject({ nivel: 'estourou', percentual: 112, excedenteCentavos: 12000 })
    expect(alerta.projecaoCentavos).toBeNull()
  })
})

describe('meta de receita', () => {
  it('25%, faltam 150000, ~5173 por dia em 29 dias (cenário do SQL)', () => {
    expect(
      progressoMetaReceita({ metaCentavos: 200000, recebidoCentavos: 50000, diasRestantes: 29 }),
    ).toEqual({
      percentual: 25,
      faltaCentavos: 150000,
      batida: false,
      porDiaCentavos: 5173,
      marcos: [25, 50, 75],
    })
  })

  it('meta batida a partir de 100%', () => {
    expect(
      progressoMetaReceita({ metaCentavos: 200000, recebidoCentavos: 210000, diasRestantes: 29 }),
    ).toMatchObject({ percentual: 105, faltaCentavos: 0, batida: true, porDiaCentavos: null })
  })

  it('sem meta e fora do mês atual', () => {
    expect(
      progressoMetaReceita({ metaCentavos: null, recebidoCentavos: 0, diasRestantes: null }),
    ).toMatchObject({ percentual: null, batida: false })
    expect(
      progressoMetaReceita({ metaCentavos: 1000, recebidoCentavos: 0, diasRestantes: null }),
    ).toMatchObject({ porDiaCentavos: null, faltaCentavos: 1000 })
  })
})

describe('projetos', () => {
  it('orçamento estourado em 500', () => {
    expect(progressoProjeto(3000, 2500)).toEqual({
      percentual: 120,
      restanteCentavos: 0,
      excedenteCentavos: 500,
      alerta: true,
    })
  })

  it('alerta a partir de 90% do orçamento; sem orçamento não há alerta', () => {
    expect(progressoProjeto(899, 1000).alerta).toBe(false)
    expect(progressoProjeto(900, 1000).alerta).toBe(true)
    expect(progressoProjeto(5000, null)).toEqual({
      percentual: null,
      restanteCentavos: null,
      excedenteCentavos: null,
      alerta: false,
    })
  })
})

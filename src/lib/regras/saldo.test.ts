import { describe, expect, it } from 'vitest'

import { type DadosSaldoConta, saldoConta, totalFatura } from './saldo'

/**
 * Mesmo cenário de supabase/tests/02_regras_financeiras.test.sql (Carla, hoje 03/10/2026).
 */
const faturaOutubro = totalFatura(
  [{ valorCentavos: 10000, excluido: false }], // parcela 1/3 da geladeira
  [{ valorCentavos: 5000, dividaExcluida: false }], // assinatura paga no cartão
)

const carla: DadosSaldoConta = {
  saldoInicialCentavos: 500000,
  receitas: [{ valorCentavos: 50000, data: '2026-10-01', excluida: false }],
  gastos: [
    { valorCentavos: 10000, data: '2026-10-03', origem: 'pix', excluido: false },
    { valorCentavos: 75000, data: '2026-10-01', origem: 'dinheiro', excluido: false },
    { valorCentavos: 1000, data: '2026-10-20', origem: 'pix', excluido: false },
    { valorCentavos: 7777, data: '2026-10-02', origem: 'pix', excluido: true },
    // Compras no cartão nunca saem direto da conta.
    { valorCentavos: 10000, data: '2026-10-05', origem: 'cartao', excluido: false },
    { valorCentavos: 5000, data: '2026-10-11', origem: 'cartao', excluido: false },
  ],
  faturasPagas: [{ totalCentavos: faturaOutubro, pagoEm: '2026-10-03' }],
  pagamentosDividas: [
    { valorCentavos: 30000, pagoEm: '2026-10-03', formaPagamento: 'conta', dividaExcluida: false },
    // Paga no cartão: já está dentro da fatura, não é descontada de novo.
    { valorCentavos: 5000, pagoEm: '2026-10-03', formaPagamento: 'cartao', dividaExcluida: false },
  ],
  gastosProjetos: [
    {
      valorCentavos: 3000,
      data: '2026-10-02',
      descontarDoSaldo: true,
      excluido: false,
      projetoExcluido: false,
    },
    {
      valorCentavos: 99900,
      data: '2026-10-02',
      descontarDoSaldo: false,
      excluido: false,
      projetoExcluido: false,
    },
  ],
}

describe('saldo da conta', () => {
  it('fatura com a assinatura dentro soma 15000', () => {
    expect(faturaOutubro).toBe(15000)
  })

  it('desconta a fatura uma vez só (sem dupla contagem da dívida no cartão)', () => {
    // 500000 + 50000 − 10000 − 75000 − 15000 − 30000 − 3000
    expect(saldoConta(carla, '2026-10-03')).toBe(417000)
  })

  it('cada movimento conta a partir da sua data', () => {
    expect(saldoConta(carla, '2026-10-31')).toBe(416000)
    expect(saldoConta(carla, '2026-09-30')).toBe(500000)
  })

  it('itens excluídos e projetos sem desconto não mexem no saldo', () => {
    const semExtras = {
      ...carla,
      gastos: carla.gastos.filter((g) => !g.excluido),
      gastosProjetos: carla.gastosProjetos.filter((g) => g.descontarDoSaldo),
    }
    expect(saldoConta(semExtras, '2026-10-03')).toBe(417000)
  })

  it('projeto excluído deixa de descontar', () => {
    const projetoExcluido = {
      ...carla,
      gastosProjetos: carla.gastosProjetos.map((g) => ({ ...g, projetoExcluido: true })),
    }
    expect(saldoConta(projetoExcluido, '2026-10-03')).toBe(420000)
  })
})

import { describe, expect, it } from 'vitest'

import {
  type DividaParaCalculo,
  dividaApareceNoMes,
  numeroParcelaDivida,
  pagaAntesDoCadastro,
  parcelasRestantes,
  previaParcelada,
  saldoDevedorDivida,
  statusDivida,
} from './dividas'

const financiamento: DividaParaCalculo = {
  infinita: false,
  totalParcelas: 12,
  parcelasJaPagas: 5,
  mesInicioRef: '2026-08',
  diaVencimento: 15,
  valorParcelaCentavos: 20000,
  ativa: true,
}

const streaming: DividaParaCalculo = {
  infinita: true,
  totalParcelas: null,
  parcelasJaPagas: 0,
  mesInicioRef: '2026-10',
  diaVencimento: 1,
  valorParcelaCentavos: 5000,
  ativa: true,
}

describe('parcela n da dívida', () => {
  it('7 já pagas: no mês de início é a parcela 8', () => {
    expect(numeroParcelaDivida(7, '2026-10', '2026-10')).toBe(8)
  })

  it('conta os meses desde o início', () => {
    expect(numeroParcelaDivida(5, '2026-08', '2026-10')).toBe(8)
    expect(numeroParcelaDivida(5, '2026-08', '2027-02')).toBe(12)
  })

  it('parcelada aparece só de 1 a total', () => {
    expect(dividaApareceNoMes(financiamento, '2027-02', false)).toBe(true)
    expect(dividaApareceNoMes(financiamento, '2027-03', false)).toBe(false)
    expect(dividaApareceNoMes(financiamento, '2026-03', false)).toBe(true) // parcela 1
    expect(dividaApareceNoMes(financiamento, '2026-02', false)).toBe(false) // parcela 0
  })

  it('recorrente aparece em todo mês a partir do início', () => {
    expect(dividaApareceNoMes(streaming, '2026-09', false)).toBe(false)
    expect(dividaApareceNoMes(streaming, '2026-10', false)).toBe(true)
    expect(dividaApareceNoMes(streaming, '2030-01', false)).toBe(true)
  })

  it('encerrada só aparece onde foi paga', () => {
    const encerrada = { ...streaming, ativa: false }
    expect(dividaApareceNoMes(encerrada, '2026-10', true)).toBe(true)
    expect(dividaApareceNoMes(encerrada, '2026-11', false)).toBe(false)
  })
})

describe('status do mês', () => {
  it('parcela anterior ao cadastro conta como paga', () => {
    expect(pagaAntesDoCadastro(financiamento, '2026-07')).toBe(true)
    expect(statusDivida(financiamento, '2026-07', false, '2026-10-03')).toBe('paga')
  })

  it('parcela depois do início sem pagamento, com vencimento passado, fica atrasada', () => {
    expect(statusDivida(financiamento, '2026-09', false, '2026-10-03')).toBe('atrasada')
  })

  it('pendente antes do vencimento; paga com pagamento', () => {
    expect(statusDivida(financiamento, '2026-10', false, '2026-10-03')).toBe('pendente')
    expect(statusDivida(financiamento, '2026-10', false, '2026-10-15')).toBe('pendente')
    expect(statusDivida(financiamento, '2026-10', false, '2026-10-16')).toBe('atrasada')
    expect(statusDivida(financiamento, '2026-10', true, '2026-10-16')).toBe('paga')
  })

  it('recorrente vencida no dia 1 fica atrasada no dia 3', () => {
    expect(statusDivida(streaming, '2026-10', false, '2026-10-03')).toBe('atrasada')
  })
})

describe('saldo devedor', () => {
  it('após o mês = (total − n) × valor', () => {
    expect(parcelasRestantes(financiamento, '2026-10')).toBe(4)
    expect(saldoDevedorDivida(financiamento, '2026-10')).toBe(80000)
    expect(saldoDevedorDivida(financiamento, '2027-02')).toBe(0)
  })

  it('recorrente não tem saldo devedor', () => {
    expect(saldoDevedorDivida(streaming, '2026-10')).toBeNull()
    expect(parcelasRestantes(streaming, '2026-10')).toBeNull()
  })

  it('prévia do formulário: restam total − já pagas', () => {
    expect(previaParcelada(12, 7, 20000)).toEqual({ restantes: 5, saldoDevedorCentavos: 100000 })
    expect(previaParcelada(3, 5, 1000)).toEqual({ restantes: 0, saldoDevedorCentavos: 0 })
  })
})

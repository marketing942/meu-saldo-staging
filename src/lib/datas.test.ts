import { describe, expect, it } from 'vitest'

import {
  dataNoMes,
  dataValida,
  diasEntre,
  diasNoMes,
  formatarData,
  formatarMesAno,
  hoje,
  horaAtual,
  lerDataBR,
  mesAdd,
  mesAtual,
  mesDiff,
  mesValido,
  situacaoDoMes,
  somarDias,
  ultimoDia,
} from './datas'

describe('hoje em America/Sao_Paulo', () => {
  it('às 23h30 de 03/10 em São Paulo ainda é 03/10, mesmo já sendo 04/10 em UTC', () => {
    const agora = new Date(Date.UTC(2026, 9, 4, 2, 30)) // 04/10 02:30 UTC = 03/10 23:30 em SP
    expect(hoje(agora)).toBe('2026-10-03')
    expect(horaAtual(agora)).toBe(23)
    expect(mesAtual(agora)).toBe('2026-10')
  })

  it('vira o mês à meia-noite de São Paulo', () => {
    expect(hoje(new Date(Date.UTC(2026, 10, 1, 3, 0)))).toBe('2026-11-01')
    expect(hoje(new Date(Date.UTC(2026, 10, 1, 2, 59)))).toBe('2026-10-31')
  })
})

describe('meses', () => {
  it('valida o formato AAAA-MM', () => {
    expect(mesValido('2026-10')).toBe(true)
    expect(mesValido('2026-13')).toBe(false)
    expect(mesValido('2026-1')).toBe(false)
    expect(() => mesAdd('2026-13', 1)).toThrow('Mês inválido')
  })

  it('soma e subtrai meses virando o ano', () => {
    expect(mesAdd('2026-12', 1)).toBe('2027-01')
    expect(mesAdd('2026-01', -1)).toBe('2025-12')
    expect(mesAdd('2026-10', -22)).toBe('2024-12')
    expect(mesAdd('2026-10', 15)).toBe('2028-01')
  })

  it('conta meses entre anos', () => {
    expect(mesDiff('2026-11', '2027-02')).toBe(3)
    expect(mesDiff('2027-02', '2026-11')).toBe(-3)
  })

  it('sabe os dias de cada mês, inclusive bissextos', () => {
    expect(diasNoMes('2026-02')).toBe(28)
    expect(diasNoMes('2028-02')).toBe(29)
    expect(diasNoMes('2026-10')).toBe(31)
    expect(ultimoDia('2026-04')).toBe('2026-04-30')
  })

  it('ajusta o dia para o último dia em meses curtos', () => {
    expect(dataNoMes('2027-02', 31)).toBe('2027-02-28')
    expect(dataNoMes('2028-02', 30)).toBe('2028-02-29')
    expect(dataNoMes('2026-10', 15)).toBe('2026-10-15')
  })

  it('classifica o mês em relação ao atual', () => {
    expect(situacaoDoMes('2026-09', '2026-10')).toBe('passado')
    expect(situacaoDoMes('2026-10', '2026-10')).toBe('atual')
    expect(situacaoDoMes('2027-01', '2026-10')).toBe('futuro')
  })
})

describe('dias', () => {
  it('soma dias atravessando meses e anos', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(diasEntre('2026-10-03', '2026-10-06')).toBe(3)
    expect(diasEntre('2026-10-06', '2026-10-03')).toBe(-3)
  })

  it('valida datas reais', () => {
    expect(dataValida('2026-02-29')).toBe(false)
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('2026-10-32')).toBe(false)
  })
})

describe('formatação pt-BR', () => {
  it('formata datas como dd/mm/aaaa sem passar por Date', () => {
    expect(formatarData('2026-10-03')).toBe('03/10/2026')
    expect(lerDataBR('03/10/2026')).toBe('2026-10-03')
    expect(lerDataBR('31/02/2026')).toBeNull()
  })

  it('formata o mês com nome em português', () => {
    expect(formatarMesAno('2026-10')).toBe('Outubro 2026')
    expect(formatarMesAno('2027-03')).toBe('Março 2027')
  })
})

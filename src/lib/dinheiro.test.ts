import { describe, expect, it } from 'vitest'

import {
  CENTAVOS_MAXIMO,
  centavosDeDigitos,
  centavosDeTexto,
  formatarCentavos,
  formatarCentavosParaCampo,
  formatarValor,
  percentual,
} from './dinheiro'

describe('formatação em R$', () => {
  it('formata centavos no padrão brasileiro', () => {
    expect(formatarCentavos(123456)).toBe('R$ 1.234,56')
    expect(formatarCentavos(5)).toBe('R$ 0,05')
    expect(formatarCentavos(0)).toBe('R$ 0,00')
    expect(formatarCentavos(-1990)).toBe('-R$ 19,90')
    expect(formatarCentavosParaCampo(123456)).toBe('1.234,56')
  })

  it('oculta valores quando pedido', () => {
    expect(formatarValor(123456, true)).toBe('R$ ••••')
    expect(formatarValor(123456, false)).toBe('R$ 1.234,56')
  })

  it('recusa valores que não são centavos inteiros', () => {
    expect(() => formatarCentavos(10.5)).toThrow()
  })
})

describe('leitura de valores', () => {
  it('teclado numérico: dígitos entram pela direita', () => {
    expect(centavosDeDigitos('1')).toBe(1)
    expect(centavosDeDigitos('1234')).toBe(1234)
    expect(centavosDeDigitos('R$ 12,34')).toBe(1234)
    expect(centavosDeDigitos('')).toBe(0)
    expect(centavosDeDigitos('9'.repeat(20))).toBe(CENTAVOS_MAXIMO)
  })

  it('entende valores escritos em reais', () => {
    expect(centavosDeTexto('1.234,56')).toBe(123456)
    expect(centavosDeTexto('1234,5')).toBe(123450)
    expect(centavosDeTexto('R$ 12')).toBe(1200)
    expect(centavosDeTexto('12.50')).toBe(1250)
    expect(centavosDeTexto('1.234')).toBe(123400)
    expect(centavosDeTexto('0,99')).toBe(99)
    expect(centavosDeTexto('-5,00')).toBe(-500)
  })

  it('recusa o que não é valor', () => {
    expect(centavosDeTexto('')).toBeNull()
    expect(centavosDeTexto('abc')).toBeNull()
    expect(centavosDeTexto('1,234')).toBeNull()
    expect(centavosDeTexto('1,2,3')).toBeNull()
  })
})

describe('percentual', () => {
  it('arredonda com 2 casas, meio para cima (como o round do Postgres)', () => {
    expect(percentual(75000, 100000)).toBe(75)
    expect(percentual(1, 3)).toBe(33.33)
    expect(percentual(2, 3)).toBe(66.67)
    expect(percentual(1, 8)).toBe(12.5)
    expect(percentual(1, 80000)).toBe(0) // 0,00125% -> 0,00
    expect(percentual(1, 40000)).toBe(0) // 0,0025% -> 0,00
    expect(percentual(1, 20000)).toBe(0.01) // 0,005% -> 0,01 (meio para cima)
    expect(percentual(210000, 200000)).toBe(105)
  })
})

/**
 * Valores monetários são sempre centavos inteiros (number no front, bigint no banco).
 * Nada de ponto flutuante em contas: só na hora de formatar.
 */
export type Centavos = number

/** Teto de digitação: R$ 999.999.999,99. */
export const CENTAVOS_MAXIMO = 99_999_999_999

export const VALOR_OCULTO = 'R$ ••••'

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatadorNumero = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function exigirInteiro(centavos: Centavos) {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Valor em centavos precisa ser inteiro: ${centavos}`)
  }
}

/** 123456 -> 'R$ 1.234,56' (espaço normal entre R$ e o número). */
export function formatarCentavos(centavos: Centavos): string {
  exigirInteiro(centavos)
  return formatadorBRL.format(centavos / 100).replace(/\u00a0/g, ' ')
}

/** Igual a formatarCentavos, mas troca por 'R$ ••••' quando os valores estão ocultos. */
export function formatarValor(centavos: Centavos, ocultar = false): string {
  return ocultar ? VALOR_OCULTO : formatarCentavos(centavos)
}

/** 123456 -> '1.234,56' (para preencher campos de valor). */
export function formatarCentavosParaCampo(centavos: Centavos): string {
  exigirInteiro(centavos)
  return formatadorNumero.format(centavos / 100)
}

/**
 * Campo com teclado numérico: os dígitos entram pela direita.
 * '1' -> 1 (R$ 0,01) · '1234' -> 1234 (R$ 12,34). Ignora o que não for dígito.
 */
export function centavosDeDigitos(texto: string): Centavos {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '')
  if (!digitos) return 0
  if (digitos.length > String(CENTAVOS_MAXIMO).length) return CENTAVOS_MAXIMO
  return Math.min(Number(digitos), CENTAVOS_MAXIMO)
}

/**
 * Lê um valor escrito em reais, no formato brasileiro.
 * '1.234,56' · '1234,5' · 'R$ 12' · '12.50' -> centavos. Retorna null se não entender.
 * Ponto seguido de exatamente 3 dígitos é separador de milhar ('1.234' = mil e duzentos).
 */
export function centavosDeTexto(texto: string): Centavos | null {
  let limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!limpo) return null

  const negativo = limpo.startsWith('-')
  if (negativo) limpo = limpo.slice(1)

  let inteiro: string
  let fracao: string

  if (limpo.includes(',')) {
    const partes = limpo.split(',')
    if (partes.length !== 2) return null
    inteiro = (partes[0] ?? '').replace(/\./g, '')
    fracao = partes[1] ?? ''
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    inteiro = limpo.replace(/\./g, '')
    fracao = ''
  } else if (limpo.includes('.')) {
    const partes = limpo.split('.')
    if (partes.length !== 2) return null
    inteiro = partes[0] ?? ''
    fracao = partes[1] ?? ''
  } else {
    inteiro = limpo
    fracao = ''
  }

  if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(fracao) || (inteiro === '' && fracao === '')) {
    return null
  }

  const centavos = Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos) || centavos > CENTAVOS_MAXIMO) return null
  return negativo ? -centavos : centavos
}

/** Percentual com 2 casas, arredondado como o round() do Postgres (meio para cima). */
export function percentual(parte: Centavos, todo: Centavos): number {
  exigirInteiro(parte)
  exigirInteiro(todo)
  if (todo <= 0) throw new Error('O total do percentual precisa ser positivo.')
  const numerador = Math.abs(parte) * 10_000
  let q = Math.floor(numerador / todo)
  if ((numerador - q * todo) * 2 >= todo) q += 1
  return (parte < 0 ? -q : q) / 100
}

import { type DataISO, type MesRef, dataNoMes, diaDe, mesAdd, mesDe } from '@/lib/datas'
import type { Centavos } from '@/lib/dinheiro'

/**
 * Regra 3 — fatura do cartão. A fatura é identificada pelo mês em que FECHA.
 * Compra até o dia de fechamento (inclusive) entra na fatura que fecha no mês
 * da compra; depois do fechamento, entra na fatura seguinte.
 * Espelha public.mes_fatura / fechamento_fatura / vencimento_fatura / gerar_parcelas.
 */

export const PARCELAS_MAXIMO = 12

export function mesFatura(dataCompra: DataISO, diaFechamento: number): MesRef {
  const mes = mesDe(dataCompra)
  return dataCompra <= dataNoMes(mes, diaFechamento) ? mes : mesAdd(mes, 1)
}

export function fechamentoFatura(mesRef: MesRef, diaFechamento: number): DataISO {
  return dataNoMes(mesRef, diaFechamento)
}

/** Vence no mesmo mês se o vencimento é depois do fechamento; senão, no mês seguinte. */
export function vencimentoFatura(
  mesRef: MesRef,
  diaFechamento: number,
  diaVencimento: number,
): DataISO {
  return diaVencimento > diaFechamento
    ? dataNoMes(mesRef, diaVencimento)
    : dataNoMes(mesAdd(mesRef, 1), diaVencimento)
}

/** Fatura (mês de fechamento) que vence dentro do mês informado. */
export function faturaQueVenceNoMes(
  mes: MesRef,
  diaFechamento: number,
  diaVencimento: number,
): MesRef {
  return diaVencimento > diaFechamento ? mes : mesAdd(mes, -1)
}

export type StatusFatura = 'aberta' | 'fechada' | 'paga'

export function statusFatura(
  mesRef: MesRef,
  diaFechamento: number,
  paga: boolean,
  hoje: DataISO,
): StatusFatura {
  if (paga) return 'paga'
  return hoje > fechamentoFatura(mesRef, diaFechamento) ? 'fechada' : 'aberta'
}

export interface Parcela {
  parcela: number
  data: DataISO
  valorCentavos: Centavos
}

/**
 * Parcelas de uma compra: uma por mês, mantendo o dia (ajustado em meses curtos).
 * O resto da divisão fica na primeira: R$ 100,00 em 3x = 33,34 + 33,33 + 33,33.
 */
export function gerarParcelas(
  valorTotalCentavos: Centavos,
  dataPrimeira: DataISO,
  totalParcelas: number,
): Parcela[] {
  if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > PARCELAS_MAXIMO) {
    throw new Error(`O número de parcelas deve ser de 1 a ${PARCELAS_MAXIMO}.`)
  }
  if (!Number.isSafeInteger(valorTotalCentavos) || valorTotalCentavos < totalParcelas) {
    throw new Error(`Valor insuficiente para ${totalParcelas} parcelas.`)
  }

  const base = Math.floor(valorTotalCentavos / totalParcelas)
  const resto = valorTotalCentavos - base * totalParcelas
  const mes = mesDe(dataPrimeira)
  const dia = diaDe(dataPrimeira)

  return Array.from({ length: totalParcelas }, (_, i) => ({
    parcela: i + 1,
    data: dataNoMes(mesAdd(mes, i), dia),
    valorCentavos: base + (i === 0 ? resto : 0),
  }))
}

/** Limite usado: tudo que está em faturas ainda não pagas (inclui parcelas futuras). */
export function limiteUsado(
  lancamentos: ReadonlyArray<{ valorCentavos: Centavos; faturaMesRef: MesRef }>,
  faturasPagas: ReadonlySet<MesRef>,
): Centavos {
  return lancamentos.reduce(
    (soma, l) => (faturasPagas.has(l.faturaMesRef) ? soma : soma + l.valorCentavos),
    0,
  )
}

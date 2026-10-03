import { type DataISO, type MesRef, dataNoMes, mesDiff } from '@/lib/datas'
import type { Centavos } from '@/lib/dinheiro'

/**
 * Regra 5 — dívidas parceladas e recorrentes.
 * Espelha public.numero_parcela_divida e public.dividas_do_mes.
 */

export interface DividaParaCalculo {
  infinita: boolean
  totalParcelas: number | null
  parcelasJaPagas: number
  mesInicioRef: MesRef
  diaVencimento: number
  valorParcelaCentavos: Centavos
  ativa: boolean
}

export type StatusDivida = 'paga' | 'pendente' | 'atrasada'

/** n no mês M = parcelas_ja_pagas + meses entre mes_inicio_ref e M + 1. */
export function numeroParcelaDivida(
  parcelasJaPagas: number,
  mesInicioRef: MesRef,
  mesRef: MesRef,
): number {
  return parcelasJaPagas + mesDiff(mesInicioRef, mesRef) + 1
}

/**
 * Parcelada aparece se 1 <= n <= total; recorrente, em todo mês desde o início.
 * Dívida encerrada (ativa = false) só aparece nos meses em que foi paga.
 */
export function dividaApareceNoMes(
  divida: DividaParaCalculo,
  mesRef: MesRef,
  temPagamento: boolean,
): boolean {
  if (!divida.ativa && !temPagamento) return false
  if (divida.infinita) return mesRef >= divida.mesInicioRef
  const n = numeroParcelaDivida(divida.parcelasJaPagas, divida.mesInicioRef, mesRef)
  return n >= 1 && n <= (divida.totalParcelas ?? 0)
}

/** Parcela paga antes do cadastro: n <= parcelas já pagas informadas. */
export function pagaAntesDoCadastro(divida: DividaParaCalculo, mesRef: MesRef): boolean {
  if (divida.infinita) return false
  return (
    numeroParcelaDivida(divida.parcelasJaPagas, divida.mesInicioRef, mesRef) <=
    divida.parcelasJaPagas
  )
}

export function vencimentoDivida(divida: DividaParaCalculo, mesRef: MesRef): DataISO {
  return dataNoMes(mesRef, divida.diaVencimento)
}

/** Paga (existe pagamento ou foi paga antes do cadastro), Pendente ou Atrasada. */
export function statusDivida(
  divida: DividaParaCalculo,
  mesRef: MesRef,
  temPagamento: boolean,
  hoje: DataISO,
): StatusDivida {
  if (temPagamento || pagaAntesDoCadastro(divida, mesRef)) return 'paga'
  return vencimentoDivida(divida, mesRef) < hoje ? 'atrasada' : 'pendente'
}

/** Parcelas que faltam depois do mês (total − n). Null para recorrentes. */
export function parcelasRestantes(divida: DividaParaCalculo, mesRef: MesRef): number | null {
  if (divida.infinita || divida.totalParcelas === null) return null
  return (
    divida.totalParcelas - numeroParcelaDivida(divida.parcelasJaPagas, divida.mesInicioRef, mesRef)
  )
}

/** Saldo devedor após o mês = (total − n) × valor da parcela. Null para recorrentes. */
export function saldoDevedorDivida(divida: DividaParaCalculo, mesRef: MesRef): Centavos | null {
  const restantes = parcelasRestantes(divida, mesRef)
  return restantes === null ? null : restantes * divida.valorParcelaCentavos
}

/** Prévia do formulário: "Restam N parcelas · saldo devedor R$ X". */
export function previaParcelada(
  totalParcelas: number,
  parcelasJaPagas: number,
  valorParcelaCentavos: Centavos,
): { restantes: number; saldoDevedorCentavos: Centavos } {
  const restantes = Math.max(totalParcelas - parcelasJaPagas, 0)
  return { restantes, saldoDevedorCentavos: restantes * valorParcelaCentavos }
}

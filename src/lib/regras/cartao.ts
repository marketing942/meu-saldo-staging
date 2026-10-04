import { type DataISO, type MesRef, dataNoMes, diaDe, mesAdd, mesDe } from '@/lib/datas'
import { type Centavos, percentual } from '@/lib/dinheiro'

import { type DividaParaCalculo, saldoDevedorContaAPagar } from './dividas'

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

/*
 * Limite do cartão. Duas fontes, sem sobreposição:
 *   1. Compras (gastos): cada parcela ocupa o limite até a fatura em que ela
 *      entrou ser paga; inclui as parcelas de meses futuros.
 *   2. Contas a pagar no cartão (dividas): ocupam o saldo devedor ainda não
 *      quitado (ver saldoDevedorContaAPagar). A parcela marcada como paga sai do
 *      saldo, por isso dividas_pagamentos não entra de novo no limite.
 */

/** Parcela de compra no cartão (à vista = 1 parcela), na fatura em que entrou. */
export interface LancamentoLimite {
  valorCentavos: Centavos
  faturaMesRef: MesRef
  /** Compra excluída não ocupa o limite. Desfazer a exclusão volta a ocupar. */
  excluido?: boolean
}

/**
 * Parte das compras no limite usado: tudo que está em faturas ainda não pagas,
 * inclusive as parcelas de meses futuros. Fatura paga devolve o valor dela.
 */
export function limiteUsado(
  lancamentos: ReadonlyArray<LancamentoLimite>,
  faturasPagas: ReadonlySet<MesRef>,
): Centavos {
  return lancamentos.reduce(
    (soma, l) => (l.excluido || faturasPagas.has(l.faturaMesRef) ? soma : soma + l.valorCentavos),
    0,
  )
}

export interface LimiteCartao {
  limiteCentavos: Centavos
  usadoCentavos: Centavos
  /** Pode ficar negativo quando as compras passam do limite. */
  disponivelCentavos: Centavos
  percentual: number
}

/** Conta a pagar com o que o limite precisa saber dela. */
export interface ContaAPagarNoCartao extends DividaParaCalculo {
  formaPagamento: 'conta' | 'cartao'
  cartaoId: string | null
  /** Excluída (deleted_at): não ocupa o limite. Desfazer volta a ocupar. */
  excluida: boolean
  /** mes_ref das parcelas marcadas como pagas. */
  mesesPagos: readonly MesRef[]
}

/**
 * Parte das contas a pagar no limite usado de um cartão: soma do saldo devedor
 * das contas pagas com ESTE cartão (as de outros cartões nunca entram).
 */
export function comprometidoPorContasAPagar(
  cartaoId: string,
  contas: ReadonlyArray<ContaAPagarNoCartao>,
  mesAtual: MesRef,
): Centavos {
  return contas
    .filter((c) => c.formaPagamento === 'cartao' && c.cartaoId === cartaoId && !c.excluida)
    .reduce((soma, c) => soma + saldoDevedorContaAPagar(c, c.mesesPagos, mesAtual), 0)
}

/**
 * Espelha public.limite_cartao: usado = compras em faturas não pagas + saldo
 * devedor das contas a pagar no cartão; disponível = limite − usado.
 */
export function limiteCartao(
  limiteCentavos: Centavos,
  compras: ReadonlyArray<LancamentoLimite>,
  faturasPagas: ReadonlySet<MesRef>,
  comprometidoContasAPagarCentavos: Centavos = 0,
): LimiteCartao {
  const usado = limiteUsado(compras, faturasPagas) + comprometidoContasAPagarCentavos
  return {
    limiteCentavos,
    usadoCentavos: usado,
    disponivelCentavos: limiteCentavos - usado,
    percentual: percentual(usado, limiteCentavos),
  }
}

/** A partir deste percentual de uso, o app avisa que o limite está acabando. */
export const LIMITE_ALERTA_PERCENTUAL = 80

/**
 * Quanto uma compra nova (ou editada) passa do disponível; 0 se cabe.
 * Na edição, o valor antigo já está no "usado" e volta antes de comparar.
 */
export function excessoNoLimite(
  disponivelCentavos: Centavos,
  valorCompraCentavos: Centavos,
  valorAnteriorCentavos: Centavos = 0,
): Centavos {
  return Math.max(valorCompraCentavos - valorAnteriorCentavos - disponivelCentavos, 0)
}

/**
 * Disponível depois de salvar uma conta a pagar no cartão. Na edição no mesmo
 * cartão, o que a conta já ocupava volta antes de descontar o novo valor.
 */
export function disponivelDepoisDaConta(
  disponivelHojeCentavos: Centavos,
  comprometeCentavos: Centavos,
  jaOcupadoNoMesmoCartaoCentavos: Centavos = 0,
): Centavos {
  return disponivelHojeCentavos + jaOcupadoNoMesmoCartaoCentavos - comprometeCentavos
}

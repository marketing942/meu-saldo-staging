import {
  type DataISO,
  type MesRef,
  type SituacaoMes,
  diaDe,
  diasNoMes,
  primeiroDia,
  situacaoDoMes,
  somarDias,
  ultimoDia,
} from '@/lib/datas'
import { type Centavos, percentual } from '@/lib/dinheiro'

/**
 * Regras 2, 6 e 7 — totais do mês, "pode gastar por dia" e previsão de desnecessários.
 * Espelha public.resumo_mes.
 */

// Dias do mês -----------------------------------------------------------------

export interface DiasDoMes {
  situacao: SituacaoMes
  diasNoMes: number
  /** Dias já vividos no mês, contando hoje. */
  diasPassados: number
  /** Dias que faltam, contando hoje. Zero em meses que já passaram. */
  diasRestantes: number
  /** Data usada para o saldo: fim do mês (passado), hoje (atual), véspera do mês (futuro). */
  dataReferencia: DataISO
}

export function diasDoMes(mes: MesRef, hoje: DataISO): DiasDoMes {
  const total = diasNoMes(mes)
  const situacao = situacaoDoMes(mes, hoje.slice(0, 7))
  if (situacao === 'passado') {
    return {
      situacao,
      diasNoMes: total,
      diasPassados: total,
      diasRestantes: 0,
      dataReferencia: ultimoDia(mes),
    }
  }
  if (situacao === 'futuro') {
    return {
      situacao,
      diasNoMes: total,
      diasPassados: 0,
      diasRestantes: total,
      dataReferencia: somarDias(primeiroDia(mes), -1),
    }
  }
  const passados = diaDe(hoje)
  return {
    situacao,
    diasNoMes: total,
    diasPassados: passados,
    diasRestantes: total - passados + 1,
    dataReferencia: hoje,
  }
}

// Gastos do mês (regra 2) -------------------------------------------------------

export interface TotaisGastos {
  totalCentavos: Centavos
  necessarioCentavos: Centavos
  desnecessarioCentavos: Centavos
}

/** Pela data da compra; cada parcela conta no mês em que cai. Projetos não entram. */
export function totaisGastosDoMes(
  gastos: ReadonlyArray<{
    valorCentavos: Centavos
    data: DataISO
    tipo: 'necessario' | 'desnecessario'
    excluido: boolean
  }>,
  mes: MesRef,
): TotaisGastos {
  const inicio = primeiroDia(mes)
  const fim = ultimoDia(mes)
  return gastos.reduce<TotaisGastos>(
    (t, g) => {
      if (g.excluido || g.data < inicio || g.data > fim) return t
      return {
        totalCentavos: t.totalCentavos + g.valorCentavos,
        necessarioCentavos: t.necessarioCentavos + (g.tipo === 'necessario' ? g.valorCentavos : 0),
        desnecessarioCentavos:
          t.desnecessarioCentavos + (g.tipo === 'desnecessario' ? g.valorCentavos : 0),
      }
    },
    { totalCentavos: 0, necessarioCentavos: 0, desnecessarioCentavos: 0 },
  )
}

// Pode gastar por dia (regra 6) -------------------------------------------------

/**
 * (saldo disponível − dívidas pendentes do mês) ÷ dias restantes (mínimo 1),
 * arredondado para baixo. Null em meses que já passaram.
 */
export function podeGastarPorDia(
  saldoCentavos: Centavos,
  dividasPendentesCentavos: Centavos,
  diasRestantes: number,
): Centavos | null {
  if (diasRestantes <= 0) return null
  return Math.floor((saldoCentavos - dividasPendentesCentavos) / Math.max(diasRestantes, 1))
}

/** Sobra no mês = saldo − dívidas pendentes − faturas que vencem no mês e não foram pagas. */
export function sobraNoMes(
  saldoCentavos: Centavos,
  dividasPendentesCentavos: Centavos,
  faturasPendentesCentavos: Centavos,
): Centavos {
  return saldoCentavos - dividasPendentesCentavos - faturasPendentesCentavos
}

// Previsão de desnecessários (regra 7) ------------------------------------------

/** ok: abaixo de 70% · atencao: 70% a 89% · forte: 90% a 99% · estourou: 100% ou mais. */
export type NivelAlerta = 'sem-meta' | 'ok' | 'atencao' | 'forte' | 'estourou'

export interface AlertaDesnecessarios {
  nivel: NivelAlerta
  percentual: number | null
  /** Quanto passou da meta (0 se não passou). */
  excedenteCentavos: Centavos
  /** Projeção para o mês inteiro no ritmo atual (só no mês atual). */
  projecaoCentavos: Centavos | null
  /** "No ritmo atual, passa da meta em ~N dias" (só quando a projeção passa da meta). */
  diasParaEstourar: number | null
}

export function nivelDoPercentual(pct: number | null): NivelAlerta {
  if (pct === null) return 'sem-meta'
  if (pct >= 100) return 'estourou'
  if (pct >= 90) return 'forte'
  if (pct >= 70) return 'atencao'
  return 'ok'
}

export function alertaDesnecessarios(params: {
  desnecessarioCentavos: Centavos
  metaCentavos: Centavos | null
  situacao: SituacaoMes
  diasPassados: number
  diasNoMes: number
}): AlertaDesnecessarios {
  const { desnecessarioCentavos: gasto, metaCentavos: meta, situacao, diasPassados } = params
  const pct = meta !== null && meta > 0 ? percentual(gasto, meta) : null

  let projecao: Centavos | null = null
  let diasParaEstourar: number | null = null

  if (situacao === 'atual' && gasto > 0 && diasPassados > 0) {
    // Inteiros primeiro e uma única divisão no fim, igual ao SQL.
    projecao = arredondarMeioParaCima((gasto * params.diasNoMes) / diasPassados)
    if (meta !== null && gasto < meta && projecao > meta) {
      diasParaEstourar = Math.max(1, Math.ceil(((meta - gasto) * diasPassados) / gasto))
    }
  }

  return {
    nivel: nivelDoPercentual(pct),
    percentual: pct,
    excedenteCentavos: meta !== null ? Math.max(gasto - meta, 0) : 0,
    projecaoCentavos: projecao,
    diasParaEstourar,
  }
}

function arredondarMeioParaCima(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

// Projetos (regra 9) --------------------------------------------------------------

export function progressoProjeto(totalCentavos: Centavos, orcamentoCentavos: Centavos | null) {
  if (orcamentoCentavos === null || orcamentoCentavos <= 0) {
    return { percentual: null, restanteCentavos: null, excedenteCentavos: null, alerta: false }
  }
  const pct = percentual(totalCentavos, orcamentoCentavos)
  return {
    percentual: pct,
    restanteCentavos: Math.max(orcamentoCentavos - totalCentavos, 0),
    excedenteCentavos: Math.max(totalCentavos - orcamentoCentavos, 0),
    /** Alerta dentro do projeto a partir de 90% do orçamento. */
    alerta: pct >= 90,
  }
}

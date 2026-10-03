import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Datas do app são texto 'YYYY-MM-DD' (sem fuso) e meses são 'YYYY-MM'.
 * Nunca use `new Date('YYYY-MM-DD')`: o JavaScript interpreta como meia-noite UTC,
 * e no Brasil (UTC-3) isso vira o dia anterior. As contas aqui usam Date.UTC.
 * Espelha as funções SQL de supabase/migrations/20261003120000_base.sql.
 */
export type DataISO = string
export type MesRef = string
export type SituacaoMes = 'passado' | 'atual' | 'futuro'

export const FUSO_HORARIO = 'America/Sao_Paulo'

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_POR_DIA = 86_400_000

export function mesValido(mes: string): mes is MesRef {
  return RE_MES.test(mes)
}

export function dataValida(data: string): data is DataISO {
  const m = RE_DATA.exec(data)
  if (!m) return false
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1) return false
  return dia <= diasNoMes(`${m[1]}-${m[2]}`)
}

function partesMes(mes: MesRef): [number, number] {
  const m = RE_MES.exec(mes)
  if (!m) throw new Error(`Mês inválido: "${mes}". Use o formato AAAA-MM.`)
  return [Number(m[1]), Number(m[2])]
}

function partesData(data: DataISO): [number, number, number] {
  const m = RE_DATA.exec(data)
  if (!m) throw new Error(`Data inválida: "${data}". Use o formato AAAA-MM-DD.`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const pad4 = (n: number) => String(n).padStart(4, '0')

function montarMes(ano: number, mes: number): MesRef {
  return `${pad4(ano)}-${pad2(mes)}`
}

function montarData(ano: number, mes: number, dia: number): DataISO {
  return `${pad4(ano)}-${pad2(mes)}-${pad2(dia)}`
}

function paraUTC(data: DataISO): number {
  const [a, m, d] = partesData(data)
  return Date.UTC(a, m - 1, d)
}

function deUTC(ms: number): DataISO {
  const d = new Date(ms)
  return montarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

// Hoje em America/Sao_Paulo ---------------------------------------------------

const formatadorHoje = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_HORARIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const formatadorHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSO_HORARIO,
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Data de hoje em São Paulo, independente do fuso do aparelho. */
export function hoje(agora: Date = new Date()): DataISO {
  const partes = formatadorHoje.formatToParts(agora)
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Hora atual (0 a 23) em São Paulo. */
export function horaAtual(agora: Date = new Date()): number {
  return Number(formatadorHora.format(agora))
}

export function mesAtual(agora: Date = new Date()): MesRef {
  return mesDe(hoje(agora))
}

// Meses ------------------------------------------------------------------------

export function mesDe(data: DataISO): MesRef {
  const [a, m] = partesData(data)
  return montarMes(a, m)
}

export function diasNoMes(mes: MesRef): number {
  const [a, m] = partesMes(mes)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

export function primeiroDia(mes: MesRef): DataISO {
  const [a, m] = partesMes(mes)
  return montarData(a, m, 1)
}

export function ultimoDia(mes: MesRef): DataISO {
  const [a, m] = partesMes(mes)
  return montarData(a, m, diasNoMes(mes))
}

/** mesAdd('2026-12', 1) = '2027-01'; aceita n negativo. */
export function mesAdd(mes: MesRef, n: number): MesRef {
  const [a, m] = partesMes(mes)
  const total = a * 12 + (m - 1) + n
  return montarMes(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1)
}

/** Meses de `de` até `ate`: mesDiff('2026-11', '2027-02') = 3. */
export function mesDiff(de: MesRef, ate: MesRef): number {
  const [a1, m1] = partesMes(de)
  const [a2, m2] = partesMes(ate)
  return a2 * 12 + m2 - (a1 * 12 + m1)
}

/** Dia `dia` no mês, ajustado para o último dia em meses curtos. */
export function dataNoMes(mes: MesRef, dia: number): DataISO {
  const [a, m] = partesMes(mes)
  return montarData(a, m, Math.min(Math.max(dia, 1), diasNoMes(mes)))
}

export function situacaoDoMes(mes: MesRef, atual: MesRef): SituacaoMes {
  if (mes < atual) return 'passado'
  if (mes > atual) return 'futuro'
  return 'atual'
}

// Dias -------------------------------------------------------------------------

export function diaDe(data: DataISO): number {
  return partesData(data)[2]
}

/** Dias de `de` até `ate` (negativo se `ate` vem antes). */
export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / MS_POR_DIA)
}

export function somarDias(data: DataISO, n: number): DataISO {
  return deUTC(paraUTC(data) + n * MS_POR_DIA)
}

// Formatação (pt-BR) -------------------------------------------------------------

/** '2026-10-03' -> '03/10/2026' */
export function formatarData(data: DataISO): string {
  const [a, m, d] = partesData(data)
  return `${pad2(d)}/${pad2(m)}/${pad4(a)}`
}

/** '03/10/2026' -> '2026-10-03' (null se inválida). */
export function lerDataBR(texto: string): DataISO | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return null
  const data = `${m[3]}-${m[2]}-${m[1]}`
  return dataValida(data) ? data : null
}

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** '2026-10' -> 'Outubro 2026' */
export function formatarMesAno(mes: MesRef): string {
  const [a, m] = partesMes(mes)
  // Dia 1 ao meio-dia local: o nome do mês não muda com o fuso do aparelho.
  return capitalizar(format(new Date(a, m - 1, 1, 12), 'MMMM yyyy', { locale: ptBR }))
}

/** '2026-10' -> 'Outubro' */
export function formatarNomeMes(mes: MesRef): string {
  const [a, m] = partesMes(mes)
  return capitalizar(format(new Date(a, m - 1, 1, 12), 'MMMM', { locale: ptBR }))
}

/** '2026-10' -> 'outubro' (no meio da frase o nome do mês vai em minúscula). */
export function nomeMesMinusculo(mes: MesRef): string {
  const [a, m] = partesMes(mes)
  return format(new Date(a, m - 1, 1, 12), 'MMMM', { locale: ptBR })
}

/** '2026-10' -> 'outubro de 2026' (para o meio da frase). */
export function mesAnoPorExtenso(mes: MesRef): string {
  return `${nomeMesMinusculo(mes)} de ${partesMes(mes)[0]}`
}

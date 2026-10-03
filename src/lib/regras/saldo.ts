import type { DataISO } from '@/lib/datas'
import type { Centavos } from '@/lib/dinheiro'

/**
 * Regras 1, 2, 4 e 9 — saldo da conta. Espelha public.saldo_contas.
 *
 * Saldo = saldo inicial + receitas − gastos Pix/dinheiro − faturas pagas
 *         − dívidas pagas na conta − gastos de projetos com "descontar do saldo".
 * Cada movimento conta a partir da sua data (pagamentos, a partir de pago_em).
 * Gasto no cartão não entra aqui: sai da conta quando a fatura é paga.
 * Dívida paga no cartão também não: já está dentro da fatura (sem dupla contagem).
 */

export interface DadosSaldoConta {
  saldoInicialCentavos: Centavos
  receitas: ReadonlyArray<{ valorCentavos: Centavos; data: DataISO; excluida: boolean }>
  gastos: ReadonlyArray<{
    valorCentavos: Centavos
    data: DataISO
    origem: 'cartao' | 'pix' | 'dinheiro'
    excluido: boolean
  }>
  /** Faturas pagas com esta conta, já com o total (compras + dívidas no cartão). */
  faturasPagas: ReadonlyArray<{ totalCentavos: Centavos; pagoEm: DataISO }>
  pagamentosDividas: ReadonlyArray<{
    valorCentavos: Centavos
    pagoEm: DataISO
    formaPagamento: 'conta' | 'cartao'
    dividaExcluida: boolean
  }>
  gastosProjetos: ReadonlyArray<{
    valorCentavos: Centavos
    data: DataISO
    descontarDoSaldo: boolean
    excluido: boolean
    projetoExcluido: boolean
  }>
}

const somar = <T>(itens: ReadonlyArray<T>, valor: (item: T) => Centavos) =>
  itens.reduce((soma, item) => soma + valor(item), 0)

export function saldoConta(dados: DadosSaldoConta, ate: DataISO): Centavos {
  const receitas = somar(
    dados.receitas.filter((r) => !r.excluida && r.data <= ate),
    (r) => r.valorCentavos,
  )
  const gastos = somar(
    dados.gastos.filter((g) => g.origem !== 'cartao' && !g.excluido && g.data <= ate),
    (g) => g.valorCentavos,
  )
  const faturas = somar(
    dados.faturasPagas.filter((f) => f.pagoEm <= ate),
    (f) => f.totalCentavos,
  )
  const dividas = somar(
    dados.pagamentosDividas.filter(
      (p) => p.formaPagamento === 'conta' && !p.dividaExcluida && p.pagoEm <= ate,
    ),
    (p) => p.valorCentavos,
  )
  const projetos = somar(
    dados.gastosProjetos.filter(
      (g) => g.descontarDoSaldo && !g.excluido && !g.projetoExcluido && g.data <= ate,
    ),
    (g) => g.valorCentavos,
  )

  return dados.saldoInicialCentavos + receitas - gastos - faturas - dividas - projetos
}

/** Total de uma fatura: compras do cartão + dívidas pagas no cartão naquela fatura. */
export function totalFatura(
  compras: ReadonlyArray<{ valorCentavos: Centavos; excluido: boolean }>,
  dividasNoCartao: ReadonlyArray<{ valorCentavos: Centavos; dividaExcluida: boolean }>,
): Centavos {
  return (
    somar(
      compras.filter((c) => !c.excluido),
      (c) => c.valorCentavos,
    ) +
    somar(
      dividasNoCartao.filter((d) => !d.dividaExcluida),
      (d) => d.valorCentavos,
    )
  )
}

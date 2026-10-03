import { useSearchParams } from 'react-router'

import { type MesRef, mesAtual, mesValido } from './datas'

/** Mês selecionado: vem de ?mes=AAAA-MM na URL; sem ele, o mês atual. */
export function useMes(): MesRef {
  const [parametros] = useSearchParams()
  const mes = parametros.get('mes')
  return mes && mesValido(mes) ? mes : mesAtual()
}

/** Troca o mês mantendo a tela. O mês atual não aparece na URL. */
export function useIrParaMes() {
  const [parametros, definirParametros] = useSearchParams()
  return (mes: MesRef) => {
    const novos = new URLSearchParams(parametros)
    if (mes === mesAtual()) novos.delete('mes')
    else novos.set('mes', mes)
    definirParametros(novos, { replace: true })
  }
}

/** Caminho com o ?mes= atual, para links entre telas do mesmo mês. */
export function useComMes() {
  const [parametros] = useSearchParams()
  const mes = parametros.get('mes')
  return (caminho: string) =>
    mes && mesValido(mes) ? `${caminho}?mes=${encodeURIComponent(mes)}` : caminho
}

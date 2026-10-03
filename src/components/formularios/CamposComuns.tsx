import type { ReactNode } from 'react'

import { Selecao } from '@/components/ui/Selecao'

/** Grupo de pílulas com legenda (escolha única). */
export function GrupoEscolha({
  legenda,
  erro,
  children,
}: {
  legenda: string
  erro?: string
  children: ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-texto">{legenda}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {erro && <p className="text-sm text-desnecessario">{erro}</p>}
    </fieldset>
  )
}

/**
 * Conta de onde sai (ou para onde vai) o dinheiro. Com uma conta só (a Carteira
 * criada no cadastro), não pede escolha: só informa qual será usada.
 */
export function CampoConta({
  contas,
  valor,
  aoMudar,
  rotulo,
}: {
  contas: readonly { conta_id: string; nome: string }[]
  valor: string
  aoMudar: (contaId: string) => void
  rotulo: string
}) {
  if (contas.length === 1) {
    return (
      <p className="text-sm text-secundario">
        {rotulo}: <span className="font-medium text-texto">{contas[0]?.nome}</span>
      </p>
    )
  }
  return (
    <Selecao rotulo={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)}>
      {contas.map((conta) => (
        <option key={conta.conta_id} value={conta.conta_id}>
          {conta.nome}
        </option>
      ))}
    </Selecao>
  )
}

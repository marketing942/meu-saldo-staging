import type { ReactNode } from 'react'

import { Selecao } from '@/components/ui/Selecao'
import { CORES } from '@/lib/dados/categorias'

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
  desabilitado = false,
}: {
  contas: readonly { conta_id: string; nome: string }[]
  valor: string
  aoMudar: (contaId: string) => void
  rotulo: string
  desabilitado?: boolean
}) {
  if (contas.length === 1) {
    return (
      <p className="text-sm text-secundario">
        {rotulo}: <span className="font-medium text-texto">{contas[0]?.nome}</span>
      </p>
    )
  }
  return (
    <Selecao
      rotulo={rotulo}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      disabled={desabilitado}
    >
      {contas.map((conta) => (
        <option key={conta.conta_id} value={conta.conta_id}>
          {conta.nome}
        </option>
      ))}
    </Selecao>
  )
}

/** Escolha de cor em bolinhas (paleta fixa, aceita pelo banco). */
export function SeletorCor({
  valor,
  aoMudar,
  legenda = 'Cor',
}: {
  valor: string
  aoMudar: (cor: string) => void
  legenda?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legenda}</legend>
      <div className="flex flex-wrap gap-1">
        {CORES.map((cor) => {
          const escolhida = valor.toUpperCase() === cor.valor
          return (
            <button
              key={cor.valor}
              type="button"
              aria-label={cor.nome}
              aria-pressed={escolhida}
              onClick={() => aoMudar(cor.valor)}
              className="inline-flex size-11 items-center justify-center rounded-full"
            >
              <span
                aria-hidden
                className={`size-7 rounded-full ${escolhida ? 'ring-2 ring-texto ring-offset-2 ring-offset-card' : ''}`}
                style={{ backgroundColor: cor.valor }}
              />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

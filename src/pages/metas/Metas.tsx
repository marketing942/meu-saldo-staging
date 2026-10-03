import { useSearchParams } from 'react-router'

import { Pilula } from '@/components/ui/Pilula'

import { AbaDesnecessarios } from './AbaDesnecessarios'
import { AbaProjetos } from './AbaProjetos'
import { AbaReceita } from './AbaReceita'

const ABAS = {
  receita: 'Meta de receita',
  desnecessarios: 'Desnecessários',
  projetos: 'Projetos',
} as const

type Aba = keyof typeof ABAS

export default function Metas() {
  const [parametros, definirParametros] = useSearchParams()
  const pedida = parametros.get('aba')
  const aba: Aba = pedida && pedida in ABAS ? (pedida as Aba) : 'receita'

  function trocar(nova: Aba) {
    const novos = new URLSearchParams(parametros)
    if (nova === 'receita') novos.delete('aba')
    else novos.set('aba', nova)
    definirParametros(novos, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Metas</h1>
      <div
        role="group"
        aria-label="Seções de metas"
        className="-mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {(Object.keys(ABAS) as Aba[]).map((chave) => (
          <Pilula key={chave} ativa={aba === chave} onClick={() => trocar(chave)}>
            {ABAS[chave]}
          </Pilula>
        ))}
      </div>
      {aba === 'receita' && <AbaReceita />}
      {aba === 'desnecessarios' && <AbaDesnecessarios />}
      {aba === 'projetos' && <AbaProjetos />}
    </div>
  )
}

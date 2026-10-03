import { PrevisaoDesnecessarios } from './PrevisaoDesnecessarios'
import { SecaoProjetos } from './SecaoProjetos'

/** Metas: previsão de desnecessários e, embaixo, os projetos (sem seletor). */
export default function Metas() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Metas</h1>
      <PrevisaoDesnecessarios />
      <SecaoProjetos />
    </div>
  )
}

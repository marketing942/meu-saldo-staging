import { Plus, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Botao } from '@/components/ui/Botao'
import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { cn } from '@/lib/cn'
import { useCategorias, useGastosDoMes } from '@/lib/consultas'
import { formatarData, formatarMesAno, mesAtual } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'

import { ROTULO_ORIGEM, ROTULO_TIPO } from './rotulos'

export default function Gastos() {
  const mes = mesAtual()
  const navegar = useNavigate()
  const gastos = useGastosDoMes(mes)
  const categorias = useCategorias()
  const nomeCategoria = new Map(categorias.data?.map((c) => [c.id, c.nome]))

  const novoGasto = (
    <Botao icone={Plus} onClick={() => void navegar('/gastos/novo')}>
      Novo gasto
    </Botao>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gastos</h1>
          <p className="text-sm text-secundario">{formatarMesAno(mes)}</p>
        </div>
        {novoGasto}
      </div>

      {gastos.isPending ? (
        <Carregando rotulo="Carregando gastos" className="flex flex-col gap-3">
          <Esqueleto className="h-20 w-full rounded-card" />
          <Esqueleto className="h-16 w-full rounded-card" />
          <Esqueleto className="h-16 w-full rounded-card" />
        </Carregando>
      ) : gastos.isError ? (
        <EstadoErro erro={gastos.error} aoTentarDeNovo={() => void gastos.refetch()} />
      ) : gastos.data.length === 0 ? (
        <EstadoVazio
          icone={Receipt}
          titulo="Nenhum gasto neste mês"
          descricao="Lance seus gastos para acompanhar quanto saiu e o que era desnecessário."
          acao={novoGasto}
        />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-3">
            <span className="text-sm text-secundario">Total no mês</span>
            <span className="valor text-xl font-semibold">
              {formatarCentavos(gastos.data.reduce((soma, g) => soma + g.valor_centavos, 0))}
            </span>
          </Card>

          <Card className="py-1">
            <ul className="divide-y divide-borda">
              {gastos.data.map((gasto) => {
                const categoria = gasto.categoria_id ? nomeCategoria.get(gasto.categoria_id) : null
                return (
                  <li key={gasto.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{gasto.descricao}</p>
                      <p className="text-sm text-secundario">
                        {[formatarData(gasto.data), categoria, ROTULO_ORIGEM[gasto.origem]]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="valor font-semibold">
                        {formatarCentavos(gasto.valor_centavos)}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          gasto.tipo === 'necessario' ? 'text-necessario' : 'text-desnecessario',
                        )}
                      >
                        {ROTULO_TIPO[gasto.tipo]}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

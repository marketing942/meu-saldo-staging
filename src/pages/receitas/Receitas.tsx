import { HandCoins, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Botao } from '@/components/ui/Botao'
import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { useReceitasRecentes } from '@/lib/consultas'
import { formatarData } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'

export default function Receitas() {
  const navegar = useNavigate()
  const receitas = useReceitasRecentes(50)

  const novaReceita = (
    <Botao icone={Plus} onClick={() => void navegar('/receitas/nova')}>
      Nova receita
    </Botao>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Receitas</h1>
          <p className="text-sm text-secundario">Últimos lançamentos</p>
        </div>
        {novaReceita}
      </div>

      {receitas.isPending ? (
        <Carregando rotulo="Carregando receitas" className="flex flex-col gap-3">
          <Esqueleto className="h-16 w-full rounded-card" />
          <Esqueleto className="h-16 w-full rounded-card" />
        </Carregando>
      ) : receitas.isError ? (
        <EstadoErro erro={receitas.error} aoTentarDeNovo={() => void receitas.refetch()} />
      ) : receitas.data.length === 0 ? (
        <EstadoVazio
          icone={HandCoins}
          titulo="Nenhuma receita ainda"
          descricao="Lance salário, freelas e outras entradas para ver seu saldo real."
          acao={novaReceita}
        />
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-borda">
            {receitas.data.map((receita) => (
              <li key={receita.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{receita.descricao}</p>
                  <p className="text-sm text-secundario">{formatarData(receita.data)}</p>
                </div>
                <span className="valor shrink-0 font-semibold text-necessario">
                  + {formatarCentavos(receita.valor_centavos)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

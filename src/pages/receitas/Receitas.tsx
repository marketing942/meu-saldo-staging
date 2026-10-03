import { HandCoins, Plus } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { useReceitasDoMes } from '@/lib/dados/receitas'
import { formatarNomeMes } from '@/lib/datas'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'

import { ListaReceitas } from './ListaReceitas'

export default function Receitas() {
  const mes = useMes()
  const receitas = useReceitasDoMes(mes)
  const formatar = useFormatarValor()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Receitas</h1>
          <p className="text-sm text-secundario">{formatarNomeMes(mes)}</p>
        </div>
        <LinkBotao to="/receitas/nova" icone={Plus}>
          Nova receita
        </LinkBotao>
      </div>

      {receitas.isPending ? (
        <Carregando rotulo="Carregando receitas" className="flex flex-col gap-3">
          <Esqueleto className="h-16 w-full rounded-card" />
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : receitas.isError ? (
        <EstadoErro erro={receitas.error} aoTentarDeNovo={() => void receitas.refetch()} />
      ) : receitas.data.length === 0 ? (
        <EstadoVazio
          icone={HandCoins}
          titulo="Nenhuma receita neste mês"
          descricao="Lance salário, freelas e outras entradas para ver seu saldo real."
          acao={<LinkBotao to="/receitas/nova">Lançar receita</LinkBotao>}
        />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-3">
            <span className="text-sm text-secundario">Total no mês</span>
            <span className="valor text-xl font-semibold text-necessario">
              {formatar(receitas.data.reduce((soma, r) => soma + r.valor_centavos, 0))}
            </span>
          </Card>
          <ListaReceitas receitas={receitas.data} />
        </>
      )}
    </div>
  )
}

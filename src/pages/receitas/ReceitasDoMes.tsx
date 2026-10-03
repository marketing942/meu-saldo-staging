import { HandCoins } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { useReceitasDoMes } from '@/lib/dados/receitas'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'

import { ListaReceitas } from './ListaReceitas'

/** Receitas do mês (seletor "Receitas" da aba Gastos). Cada linha abre a edição. */
export function ReceitasDoMes() {
  const mes = useMes()
  const receitas = useReceitasDoMes(mes)
  const formatar = useFormatarValor()

  if (receitas.isPending) {
    return (
      <Carregando rotulo="Carregando receitas" className="flex flex-col gap-3">
        <Esqueleto className="h-16 w-full rounded-card" />
        <Esqueleto className="h-32 w-full rounded-card" />
      </Carregando>
    )
  }
  if (receitas.isError) {
    return <EstadoErro erro={receitas.error} aoTentarDeNovo={() => void receitas.refetch()} />
  }
  if (receitas.data.length === 0) {
    return (
      <EstadoVazio
        icone={HandCoins}
        titulo="Nenhuma receita neste mês"
        descricao="Lance salário, freelas e outras entradas para ver seu saldo real."
        acao={<LinkBotao to="/receitas/nova">Lançar receita</LinkBotao>}
      />
    )
  }
  return (
    <>
      <Card className="flex items-center justify-between gap-3">
        <span className="text-sm text-secundario">Total no mês</span>
        <span className="valor text-xl font-semibold text-necessario">
          {formatar(receitas.data.reduce((soma, r) => soma + r.valor_centavos, 0))}
        </span>
      </Card>
      <ListaReceitas receitas={receitas.data} />
    </>
  )
}

import { Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { Inicial } from '@/components/ui/Inicial'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { Pilula } from '@/components/ui/Pilula'
import { cn } from '@/lib/cn'
import { useCartoes } from '@/lib/dados/cartoes'
import { useCategorias } from '@/lib/dados/categorias'
import { type Gasto, useGastosDoMes } from '@/lib/dados/gastos'
import { formatarData, formatarNomeMes } from '@/lib/datas'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'
import { ReceitasDoMes } from '@/pages/receitas/ReceitasDoMes'

import { ROTULO_ORIGEM, ROTULO_TIPO } from './rotulos'

const FILTROS = {
  todos: { rotulo: 'Todos', aceita: () => true },
  necessario: { rotulo: 'Necessário', aceita: (g: Gasto) => g.tipo === 'necessario' },
  desnecessario: { rotulo: 'Desnecessário', aceita: (g: Gasto) => g.tipo === 'desnecessario' },
  cartao: { rotulo: 'Cartão', aceita: (g: Gasto) => g.origem === 'cartao' },
  pix: { rotulo: 'Pix', aceita: (g: Gasto) => g.origem === 'pix' },
  dinheiro: { rotulo: 'Dinheiro', aceita: (g: Gasto) => g.origem === 'dinheiro' },
} as const

type Filtro = keyof typeof FILTROS

type Aba = 'gastos' | 'receitas'

/** Aba Gastos, com o seletor "Gastos | Receitas" (?aba=receitas). */
export default function Gastos() {
  const mes = useMes()
  const [parametros, definirParametros] = useSearchParams()
  const aba: Aba = parametros.get('aba') === 'receitas' ? 'receitas' : 'gastos'

  function trocar(nova: Aba) {
    const novos = new URLSearchParams(parametros)
    if (nova === 'gastos') novos.delete('aba')
    else novos.set('aba', nova)
    definirParametros(novos, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{aba === 'gastos' ? 'Gastos' : 'Receitas'}</h1>
          <p className="text-sm text-secundario">{formatarNomeMes(mes)}</p>
        </div>
        {aba === 'gastos' ? (
          <LinkBotao to="/gastos/novo" icone={Plus}>
            Novo gasto
          </LinkBotao>
        ) : (
          <LinkBotao to="/receitas/nova" icone={Plus}>
            Nova receita
          </LinkBotao>
        )}
      </div>

      <div role="group" aria-label="Ver gastos ou receitas" className="grid grid-cols-2 gap-2">
        <Pilula
          ativa={aba === 'gastos'}
          onClick={() => trocar('gastos')}
          className="justify-center"
        >
          Gastos
        </Pilula>
        <Pilula
          ativa={aba === 'receitas'}
          onClick={() => trocar('receitas')}
          className="justify-center"
        >
          Receitas
        </Pilula>
      </div>

      {aba === 'gastos' ? <GastosDoMes /> : <ReceitasDoMes />}
    </div>
  )
}

function GastosDoMes() {
  const mes = useMes()
  const gastos = useGastosDoMes(mes)
  const categorias = useCategorias()
  const cartoes = useCartoes()
  const formatar = useFormatarValor()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const nomeCategoria = new Map(categorias.data?.map((c) => [c.id, c.nome]))
  const nomeCartao = new Map(cartoes.data?.map((c) => [c.id, c.nome]))
  const filtrados = gastos.data?.filter(FILTROS[filtro].aceita) ?? []
  const porDia = agruparPorData(filtrados)

  function detalhe(gasto: Gasto): string {
    const origem =
      gasto.origem === 'cartao'
        ? `Cartão ${nomeCartao.get(gasto.cartao_id ?? '') ?? ''}`.trim() +
          (gasto.total_parcelas > 1 ? ` · ${gasto.parcela_atual}/${gasto.total_parcelas}` : '')
        : ROTULO_ORIGEM[gasto.origem]
    const categoria = gasto.categoria_id ? nomeCategoria.get(gasto.categoria_id) : undefined
    return [categoria ?? 'Sem categoria', origem].join(' · ')
  }

  return (
    <>
      <div
        role="group"
        aria-label="Filtrar gastos"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {(Object.keys(FILTROS) as Filtro[]).map((chave) => (
          <Pilula key={chave} ativa={filtro === chave} onClick={() => setFiltro(chave)}>
            {FILTROS[chave].rotulo}
          </Pilula>
        ))}
      </div>

      {gastos.isPending ? (
        <Carregando rotulo="Carregando gastos" className="flex flex-col gap-3">
          <Esqueleto className="h-16 w-full rounded-card" />
          <Esqueleto className="h-40 w-full rounded-card" />
        </Carregando>
      ) : gastos.isError ? (
        <EstadoErro erro={gastos.error} aoTentarDeNovo={() => void gastos.refetch()} />
      ) : filtrados.length === 0 ? (
        <EstadoVazio
          icone={Receipt}
          titulo={gastos.data.length === 0 ? 'Nenhum gasto neste mês' : 'Nenhum gasto neste filtro'}
          descricao={
            gastos.data.length === 0
              ? 'Toque em "Novo gasto" para lançar o primeiro.'
              : 'Troque o filtro para ver os outros gastos do mês.'
          }
          acao={<LinkBotao to="/gastos/novo">Lançar gasto</LinkBotao>}
        />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-3">
            <span className="text-sm text-secundario">
              Total {filtro === 'todos' ? 'no mês' : `(${FILTROS[filtro].rotulo.toLowerCase()})`}
            </span>
            <span className="valor text-xl font-semibold">
              {formatar(filtrados.reduce((soma, g) => soma + g.valor_centavos, 0))}
            </span>
          </Card>

          {porDia.map(([data, doDia]) => (
            <section key={data} aria-label={formatarData(data)} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-secundario">{formatarData(data)}</h2>
              <Card className="py-1">
                <ul className="divide-y divide-borda">
                  {doDia.map((gasto) => (
                    <li key={gasto.id}>
                      <Link
                        to={`/gastos/${gasto.id}`}
                        className="-mx-2 flex items-center gap-3 rounded-campo px-2 py-3 hover:bg-fundo"
                      >
                        <Inicial nome={gasto.descricao} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{gasto.descricao}</p>
                          <p className="truncate text-sm text-secundario">{detalhe(gasto)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end">
                          <span className="valor font-semibold">
                            {formatar(gasto.valor_centavos)}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              gasto.tipo === 'necessario'
                                ? 'text-necessario'
                                : 'text-desnecessario',
                            )}
                          >
                            {ROTULO_TIPO[gasto.tipo]}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}
    </>
  )
}

function agruparPorData(gastos: readonly Gasto[]): [string, Gasto[]][] {
  const grupos = new Map<string, Gasto[]>()
  for (const gasto of gastos) {
    const lista = grupos.get(gasto.data)
    if (lista) lista.push(gasto)
    else grupos.set(gasto.data, [gasto])
  }
  return [...grupos.entries()]
}

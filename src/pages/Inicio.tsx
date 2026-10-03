import { HandCoins, Plus, Receipt } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Botao } from '@/components/ui/Botao'
import { Card, TituloCard } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { useContas, useReceitasRecentes, useResumoMes } from '@/lib/consultas'
import { formatarData, formatarMesAno, mesAtual } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'

export default function Inicio() {
  const mes = mesAtual()
  const navegar = useNavigate()
  const resumo = useResumoMes(mes)

  const acoes = (
    <div className="grid grid-cols-2 gap-3">
      <Botao icone={Plus} onClick={() => void navegar('/gastos/novo')}>
        Gasto
      </Botao>
      <Botao variante="secundario" icone={Plus} onClick={() => void navegar('/receitas/nova')}>
        Receita
      </Botao>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="fonte-display text-2xl">{formatarMesAno(mes)}</h1>

      {resumo.isPending ? (
        <Carregando rotulo="Carregando resumo do mês" className="flex flex-col gap-4">
          <Esqueleto className="h-28 w-full rounded-card" />
          <div className="grid grid-cols-2 gap-4">
            <Esqueleto className="h-24 rounded-card" />
            <Esqueleto className="h-24 rounded-card" />
          </div>
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : resumo.isError ? (
        <EstadoErro erro={resumo.error} aoTentarDeNovo={() => void resumo.refetch()} />
      ) : (
        <>
          <Card>
            <TituloCard>Saldo total</TituloCard>
            <p className="valor mt-1 text-3xl font-semibold">
              {formatarCentavos(resumo.data.saldo_total_centavos)}
            </p>
            <Contas />
          </Card>

          {acoes}

          {resumo.data.gastos_mes_centavos === 0 && resumo.data.receitas_mes_centavos === 0 ? (
            <EstadoVazio
              icone={Receipt}
              titulo="Nada lançado neste mês"
              descricao="Lance uma receita ou um gasto para ver o resumo do mês aqui."
              acao={
                <Botao variante="secundario" onClick={() => void navegar('/gastos/novo')}>
                  Lançar primeiro gasto
                </Botao>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <TituloCard>Gastos do mês</TituloCard>
                  <p className="valor mt-1 text-xl font-semibold">
                    {formatarCentavos(resumo.data.gastos_mes_centavos)}
                  </p>
                </Card>
                <Card>
                  <TituloCard>Receitas do mês</TituloCard>
                  <p className="valor mt-1 text-xl font-semibold">
                    {formatarCentavos(resumo.data.receitas_mes_centavos)}
                  </p>
                </Card>
              </div>

              <NecessarioDesnecessario
                necessario={resumo.data.necessario_centavos}
                desnecessario={resumo.data.desnecessario_centavos}
              />
            </>
          )}

          <ReceitasRecentes />
        </>
      )}
    </div>
  )
}

function Contas() {
  const contas = useContas()
  if (!contas.data || contas.data.length < 2) return null
  return (
    <ul className="mt-3 flex flex-col gap-1 border-t border-borda pt-3 text-sm">
      {contas.data.map((conta) => (
        <li key={conta.conta_id} className="flex justify-between gap-3">
          <span className="text-secundario">{conta.nome}</span>
          <span className="valor">{formatarCentavos(conta.saldo_centavos)}</span>
        </li>
      ))}
    </ul>
  )
}

function NecessarioDesnecessario({
  necessario,
  desnecessario,
}: {
  necessario: number
  desnecessario: number
}) {
  const total = necessario + desnecessario
  const pctNecessario = total > 0 ? Math.round((necessario * 100) / total) : 0
  return (
    <Card>
      <TituloCard>Necessário vs. desnecessário</TituloCard>
      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-borda"
        role="img"
        aria-label={`${pctNecessario}% necessário e ${total > 0 ? 100 - pctNecessario : 0}% desnecessário`}
      >
        {total > 0 && (
          <>
            <div className="bg-necessario" style={{ width: `${pctNecessario}%` }} />
            <div className="flex-1 bg-desnecessario" />
          </>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-secundario">
            <span aria-hidden className="size-2 rounded-full bg-necessario" />
            Necessário
          </dt>
          <dd className="valor mt-0.5 text-base font-semibold">{formatarCentavos(necessario)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-secundario">
            <span aria-hidden className="size-2 rounded-full bg-desnecessario" />
            Desnecessário
          </dt>
          <dd className="valor mt-0.5 text-base font-semibold">
            {formatarCentavos(desnecessario)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

function ReceitasRecentes() {
  const receitas = useReceitasRecentes(5)
  const navegar = useNavigate()

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <TituloCard>Receitas recentes</TituloCard>
        <Link
          to="/receitas"
          className="text-sm font-medium text-destaque underline-offset-4 hover:underline"
        >
          Ver todas
        </Link>
      </div>
      {receitas.isPending ? (
        <Carregando rotulo="Carregando receitas" className="mt-3 flex flex-col gap-2">
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-10 w-full" />
        </Carregando>
      ) : receitas.isError ? (
        <EstadoErro
          className="mt-3"
          erro={receitas.error}
          aoTentarDeNovo={() => void receitas.refetch()}
        />
      ) : receitas.data.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-2 text-sm text-secundario">
          <p>Nenhuma receita lançada ainda.</p>
          <Botao variante="texto" icone={HandCoins} onClick={() => void navegar('/receitas/nova')}>
            Lançar receita
          </Botao>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-borda">
          {receitas.data.map((receita) => (
            <li key={receita.id} className="flex items-center justify-between gap-3 py-2.5">
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
      )}
    </Card>
  )
}

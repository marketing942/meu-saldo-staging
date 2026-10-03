import { CircleAlert, HandCoins, Plus, Target } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card, TituloCard } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { quandoTerminar } from '@/lib/dados/comum'
import {
  type ProgressoMeta,
  useProgressoMetaReceita,
  useSalvarMetaReceita,
} from '@/lib/dados/metas'
import { useReceitasDoMes } from '@/lib/dados/receitas'
import { type MesRef, formatarNomeMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'
import { ListaReceitas } from '@/pages/receitas/ListaReceitas'
import { useAvisos } from '@/stores/avisos'

export function AbaReceita() {
  const mes = useMes()
  const progresso = useProgressoMetaReceita(mes)
  const receitas = useReceitasDoMes(mes)

  return (
    <div className="flex flex-col gap-4">
      {progresso.isPending ? (
        <Carregando rotulo="Carregando meta de receita">
          <Esqueleto className="h-56 w-full rounded-card" />
        </Carregando>
      ) : progresso.isError ? (
        <EstadoErro erro={progresso.error} aoTentarDeNovo={() => void progresso.refetch()} />
      ) : (
        <CardMeta
          key={`${mes}-${progresso.data?.meta_centavos ?? 0}`}
          mes={mes}
          progresso={progresso.data}
        />
      )}

      <section aria-labelledby="titulo-receitas-mes" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-receitas-mes" className="text-sm font-medium text-secundario">
            Receitas de {formatarNomeMes(mes)}
          </h2>
          <LinkBotao to="/receitas/nova" variante="texto" icone={Plus} className="text-sm">
            Registrar receita
          </LinkBotao>
        </div>
        {receitas.isPending ? (
          <Esqueleto className="h-24 w-full rounded-card" />
        ) : receitas.isError ? (
          <EstadoErro erro={receitas.error} aoTentarDeNovo={() => void receitas.refetch()} />
        ) : receitas.data.length === 0 ? (
          <Card className="flex items-center gap-3 text-sm text-secundario">
            <HandCoins aria-hidden size={20} className="text-destaque" />
            Nenhuma receita lançada neste mês.
          </Card>
        ) : (
          <ListaReceitas receitas={receitas.data} />
        )}
      </section>
    </div>
  )
}

function CardMeta({ mes, progresso }: { mes: MesRef; progresso: ProgressoMeta | null }) {
  const formatar = useFormatarValor()
  const salvarMeta = useSalvarMetaReceita()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const meta = progresso?.meta_centavos ?? null
  const anterior = progresso?.meta_mes_anterior_centavos ?? null
  const recebido = progresso?.recebido_centavos ?? 0
  const [valor, setValor] = useState(meta ?? 0)
  const [editando, setEditando] = useState(meta === null)

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (valor <= 0) return
    quandoTerminar(salvarMeta.mutateAsync({ mes, valor }), () => {
      mostrarAviso('Meta salva.')
      setEditando(false)
    })
  }

  return (
    <Card className="flex flex-col gap-4">
      <TituloCard>Meta de receita de {formatarNomeMes(mes)}</TituloCard>
      {salvarMeta.isError && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(salvarMeta.error)}
        </Alerta>
      )}

      {editando ? (
        <form onSubmit={salvar} className="flex flex-col gap-3">
          <CampoValor rotulo="Quero receber (R$)" centavos={valor} aoMudar={setValor} />
          {meta === null && anterior !== null && (
            <Botao
              variante="texto"
              className="self-start text-sm"
              onClick={() => setValor(anterior)}
            >
              Usar a meta do mês passado ({formatarCentavos(anterior)})
            </Botao>
          )}
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              icone={Target}
              carregando={salvarMeta.isPending}
              disabled={valor <= 0}
            >
              Salvar meta
            </Botao>
            {meta !== null && (
              <Botao variante="secundario" onClick={() => setEditando(false)}>
                Cancelar
              </Botao>
            )}
          </div>
        </form>
      ) : (
        meta !== null && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="valor text-3xl font-semibold text-necessario">{formatar(recebido)}</p>
              <p className="text-sm text-secundario">
                de <span className="valor font-medium text-texto">{formatar(meta)}</span>
              </p>
            </div>
            <BarraProgresso
              rotulo="Progresso da meta de receita"
              percentual={progresso?.percentual ?? 0}
              cor="bg-necessario"
              marcos={[25, 50, 75]}
              className="h-3.5"
            />
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-semibold">
                {Math.round(progresso?.percentual ?? 0)}% da meta
              </span>
              <span className="text-secundario">
                {progresso?.batida
                  ? 'Meta batida!'
                  : `Faltam ${formatar(progresso?.falta_centavos ?? 0)}`}
              </span>
            </div>
            {progresso &&
              progresso.por_dia_centavos !== null &&
              progresso.dias_restantes !== null && (
                <Alerta tom="destaque" icone={Target}>
                  Para chegar lá, entre <strong>{formatar(progresso.por_dia_centavos)}</strong> por
                  dia nos próximos {progresso.dias_restantes}{' '}
                  {progresso.dias_restantes === 1 ? 'dia' : 'dias'}.
                </Alerta>
              )}
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setEditando(true)}>
                Alterar meta
              </Botao>
              <Botao
                variante="texto"
                carregando={salvarMeta.isPending}
                onClick={() =>
                  quandoTerminar(salvarMeta.mutateAsync({ mes, valor: null }), () =>
                    mostrarAviso('Meta removida.'),
                  )
                }
              >
                Remover meta
              </Botao>
            </div>
          </>
        )
      )}
    </Card>
  )
}

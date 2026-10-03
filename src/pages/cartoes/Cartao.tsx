import { CircleAlert, CreditCard, Pencil, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { CampoConta } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { Card, TituloCard } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { quandoTerminar } from '@/lib/dados/comum'
import { cn } from '@/lib/cn'
import {
  useDesfazerPagamentoFatura,
  useFatura,
  useLancamentosFatura,
  usePagarFatura,
} from '@/lib/dados/cartoes'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { formatarData, formatarNomeMes } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

const ROTULO_STATUS = { aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga' } as const

/** Fatura do cartão que fecha no mês selecionado. */
export default function Cartao() {
  const { cartaoId = '' } = useParams()
  const mes = useMes()
  const fatura = useFatura(cartaoId, mes)
  const lancamentos = useLancamentosFatura(cartaoId, mes)
  const formatar = useFormatarValor()

  if (fatura.isPending) {
    return (
      <Carregando rotulo="Carregando fatura" className="flex flex-col gap-4">
        <Esqueleto className="h-48 w-full rounded-card" />
        <Esqueleto className="h-40 w-full rounded-card" />
      </Carregando>
    )
  }
  if (fatura.isError) {
    return <EstadoErro erro={fatura.error} aoTentarDeNovo={() => void fatura.refetch()} />
  }
  if (!fatura.data) {
    return (
      <EstadoVazio
        icone={CreditCard}
        titulo="Cartão não encontrado"
        descricao="Ele pode ter sido excluído."
        acao={<LinkBotao to="/configuracoes/cartoes">Ver cartões</LinkBotao>}
      />
    )
  }
  const f = fatura.data

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span aria-hidden className="size-4 rounded-full" style={{ backgroundColor: f.cor }} />
            {f.nome}
          </h1>
          <p className="text-sm text-secundario">Fatura que fecha em {formatarNomeMes(mes)}</p>
        </div>
        <LinkBotao to="/configuracoes/cartoes" variante="texto" icone={Pencil} className="text-sm">
          Editar
        </LinkBotao>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <TituloCard>Total da fatura</TituloCard>
            <p className="valor mt-1 text-3xl font-semibold">{formatar(f.total_centavos)}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium',
              f.status === 'paga'
                ? 'bg-necessario/10 text-necessario'
                : f.status === 'fechada'
                  ? 'bg-alerta/15 text-texto'
                  : 'bg-destaque/10 text-destaque',
            )}
          >
            {ROTULO_STATUS[f.status]}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-secundario">Fecha em</dt>
            <dd className="font-medium">{formatarData(f.data_fechamento)}</dd>
          </div>
          <div>
            <dt className="text-secundario">Vence em</dt>
            <dd className="font-medium">
              {formatarData(f.data_vencimento)}
              {f.status !== 'paga' && f.dias_para_vencer >= 0 && (
                <span className="text-secundario">
                  {' '}
                  ({f.dias_para_vencer === 0 ? 'hoje' : `em ${f.dias_para_vencer} d`})
                </span>
              )}
            </dd>
          </div>
          {f.dividas_centavos > 0 && (
            <div className="col-span-2 text-secundario">
              Inclui {formatar(f.dividas_centavos)} de dívidas pagas no cartão.
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-1.5">
          <BarraProgresso
            rotulo="Limite usado"
            percentual={f.limite_percentual}
            cor={f.limite_percentual >= 90 ? 'bg-desnecessario' : 'bg-destaque'}
          />
          <p className="text-sm text-secundario">
            Limite usado {Math.round(f.limite_percentual)}% · disponível{' '}
            <span className="valor font-medium text-texto">
              {formatar(f.limite_disponivel_centavos)}
            </span>{' '}
            de {formatar(f.limite_centavos)}
          </p>
        </div>
        <Pagamento
          cartaoId={f.cartao_id}
          status={f.status}
          total={f.total_centavos}
          pagoEm={f.pago_em}
          contaPagamentoId={f.conta_pagamento_id}
        />
      </Card>

      <section aria-labelledby="titulo-lancamentos" className="flex flex-col gap-2">
        <h2 id="titulo-lancamentos" className="text-sm font-medium text-secundario">
          Lançamentos ({f.qtd_compras} {f.qtd_compras === 1 ? 'compra' : 'compras'})
        </h2>
        {lancamentos.isPending ? (
          <Esqueleto className="h-32 w-full rounded-card" />
        ) : lancamentos.isError ? (
          <EstadoErro erro={lancamentos.error} aoTentarDeNovo={() => void lancamentos.refetch()} />
        ) : lancamentos.data.length === 0 ? (
          <Card className="text-sm text-secundario">Nenhum lançamento nesta fatura.</Card>
        ) : (
          <Card className="py-1">
            <ul className="divide-y divide-borda">
              {lancamentos.data.map((l) => (
                <li key={`${l.tipo}-${l.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.descricao}</p>
                    <p className="text-sm text-secundario">
                      {formatarData(l.data)}
                      {l.tipo === 'divida' && ' · dívida'}
                      {l.total_parcelas > 1 && ` · parcela ${l.parcela_atual}/${l.total_parcelas}`}
                    </p>
                  </div>
                  <span className="valor shrink-0 font-semibold">{formatar(l.valor_centavos)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

function Pagamento({
  cartaoId,
  status,
  total,
  pagoEm,
  contaPagamentoId,
}: {
  cartaoId: string
  status: 'aberta' | 'fechada' | 'paga'
  total: number
  pagoEm: string | null
  contaPagamentoId: string | null
}) {
  const mes = useMes()
  const contas = useContas()
  const pagar = usePagarFatura()
  const desfazer = useDesfazerPagamentoFatura()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [contaEscolhida, setContaEscolhida] = useState('')

  if (status === 'paga') {
    const conta = contas.data?.find((c) => c.conta_id === contaPagamentoId)
    return (
      <div className="flex flex-col gap-2 border-t border-borda pt-3">
        <p className="text-sm">
          Paga em {pagoEm ? formatarData(pagoEm) : '—'}
          {conta && ` com ${conta.nome}`}.
        </p>
        {desfazer.isError && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(desfazer.error)}
          </Alerta>
        )}
        <ConfirmarAcao
          rotulo="Desfazer pagamento"
          icone={Undo2}
          variante="secundario"
          pergunta="Desfazer o pagamento desta fatura? O valor volta para a conta."
          rotuloConfirmar="Desfazer"
          carregando={desfazer.isPending}
          aoConfirmar={() =>
            quandoTerminar(desfazer.mutateAsync({ cartaoId, mes }), () =>
              mostrarAviso('Pagamento desfeito.'),
            )
          }
        />
      </div>
    )
  }
  if (total === 0 || !contas.data || contas.data.length === 0) return null

  const contaId = contaEscolhida || contaPadrao(contas.data)?.conta_id || ''
  return (
    <div className="flex flex-col gap-3 border-t border-borda pt-3">
      {pagar.isError && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(pagar.error)}
        </Alerta>
      )}
      <CampoConta
        rotulo="Pagar com a conta"
        contas={contas.data}
        valor={contaId}
        aoMudar={setContaEscolhida}
      />
      <Botao
        larguraTotal
        carregando={pagar.isPending}
        onClick={() =>
          quandoTerminar(pagar.mutateAsync({ cartaoId, mes, contaId }), () =>
            mostrarAviso('Fatura marcada como paga.'),
          )
        }
      >
        Marcar fatura como paga
      </Botao>
    </div>
  )
}

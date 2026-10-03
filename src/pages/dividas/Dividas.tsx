import { Check, Landmark, Plus, Undo2 } from 'lucide-react'
import { Link } from 'react-router'

import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { Card, TituloCard } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { Inicial } from '@/components/ui/Inicial'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { quandoTerminar } from '@/lib/dados/comum'
import { cn } from '@/lib/cn'
import {
  type DividaDoMes,
  ROTULO_TIPO_DIVIDA,
  useDesfazerPagamentoDivida,
  useDividasDoMes,
  usePagarDivida,
} from '@/lib/dados/dividas'
import { diaDe, formatarData, formatarMesAno } from '@/lib/datas'
import { useMes } from '@/lib/mes'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

export default function Dividas() {
  const mes = useMes()
  const dividas = useDividasDoMes(mes)
  const formatar = useFormatarValor()

  const lista = dividas.data ?? []
  const total = lista.reduce((s, d) => s + d.valor_centavos, 0)
  const pago = lista.filter((d) => d.status === 'paga').reduce((s, d) => s + d.valor_centavos, 0)
  const saldoDevedor = lista.reduce((s, d) => s + (d.saldo_devedor_centavos ?? 0), 0)
  const assinaturas = lista
    .filter((d) => d.infinita && d.tipo === 'assinatura')
    .reduce((s, d) => s + d.valor_centavos, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dívidas</h1>
        <LinkBotao to="/dividas/nova" icone={Plus}>
          Nova dívida
        </LinkBotao>
      </div>

      {dividas.isPending ? (
        <Carregando rotulo="Carregando dívidas" className="flex flex-col gap-3">
          <Esqueleto className="h-40 w-full rounded-card" />
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : dividas.isError ? (
        <EstadoErro erro={dividas.error} aoTentarDeNovo={() => void dividas.refetch()} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          icone={Landmark}
          titulo="Nenhuma dívida neste mês"
          descricao="Cadastre financiamentos, empréstimos, aluguel e assinaturas para ver o que vence a cada mês."
          acao={<LinkBotao to="/dividas/nova">Cadastrar dívida</LinkBotao>}
        />
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div>
              <TituloCard>Você vai pagar em {formatarMesAno(mes)}</TituloCard>
              <p className="valor mt-1 text-3xl font-semibold">{formatar(total)}</p>
            </div>
            <BarraProgresso
              rotulo="Parte já paga das dívidas do mês"
              percentual={total > 0 ? (pago * 100) / total : 0}
              cor="bg-necessario"
            />
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-necessario">
                Pago <span className="valor font-semibold">{formatar(pago)}</span>
              </span>
              <span className="text-desnecessario">
                Falta <span className="valor font-semibold">{formatar(total - pago)}</span>
              </span>
            </div>
            {(saldoDevedor > 0 || assinaturas > 0) && (
              <dl className="flex flex-col gap-1 border-t border-borda pt-3 text-sm">
                {saldoDevedor > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-secundario">Saldo devedor das parceladas após este mês</dt>
                    <dd className="valor font-medium">{formatar(saldoDevedor)}</dd>
                  </div>
                )}
                {assinaturas > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-secundario">Assinaturas</dt>
                    <dd className="valor font-medium">
                      {formatar(assinaturas)}/mês · {formatar(assinaturas * 12)}/ano
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          <ul className="flex flex-col gap-3">
            {lista.map((divida) => (
              <li key={divida.divida_id}>
                <CardDivida divida={divida} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CardDivida({ divida }: { divida: DividaDoMes }) {
  const mes = useMes()
  const formatar = useFormatarValor()
  const pagar = usePagarDivida()
  const desfazer = useDesfazerPagamentoDivida()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const total = divida.total_parcelas
  const paga = divida.status === 'paga'

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Inicial nome={divida.nome} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/dividas/${divida.divida_id}`}
            className="block truncate font-medium underline-offset-4 hover:underline"
          >
            {divida.nome}
          </Link>
          <p className="text-sm text-secundario">
            {formatar(divida.valor_centavos)} · vence dia {diaDe(divida.data_vencimento)} ·{' '}
            {ROTULO_TIPO_DIVIDA[divida.tipo]}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            divida.infinita ? 'bg-necessario/10 text-necessario' : 'bg-destaque/10 text-destaque',
          )}
        >
          {divida.infinita ? '∞ recorrente' : `parcela ${divida.parcela_numero}/${total ?? '?'}`}
        </span>
      </div>

      {!divida.infinita && total !== null && (
        <div className="mt-3 flex flex-col gap-1.5">
          <BarraProgresso
            rotulo={`Parcelas de ${divida.nome}`}
            percentual={((divida.parcela_numero - (paga ? 0 : 1)) * 100) / total}
          />
          <p className="text-sm text-secundario">
            {divida.parcelas_restantes === 0
              ? 'Última parcela'
              : `Restam ${divida.parcelas_restantes} parcelas depois desta`}
            {divida.saldo_devedor_centavos !== null && divida.saldo_devedor_centavos > 0 && (
              <>
                {' '}
                · saldo devedor{' '}
                <span className="valor">{formatar(divida.saldo_devedor_centavos)}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={cn(
            'text-sm font-semibold',
            paga
              ? 'text-necessario'
              : divida.status === 'atrasada'
                ? 'text-desnecessario'
                : 'text-secundario',
          )}
        >
          {divida.paga_antes_do_cadastro
            ? 'Paga antes do cadastro'
            : paga
              ? `Paga${divida.pago_em ? ` em ${formatarData(divida.pago_em)}` : ''}`
              : divida.status === 'atrasada'
                ? 'Atrasada'
                : 'Pendente'}
          {divida.forma_pagamento === 'cartao' && (
            <span className="font-normal text-secundario"> · no cartão</span>
          )}
        </span>
        {!divida.paga_antes_do_cadastro &&
          (paga && divida.pagamento_id ? (
            <Botao
              variante="texto"
              icone={Undo2}
              className="text-sm"
              carregando={desfazer.isPending}
              onClick={() => {
                if (!divida.pagamento_id) return
                quandoTerminar(
                  desfazer.mutateAsync(divida.pagamento_id),
                  () => mostrarAviso('Pagamento desfeito.'),
                  () => mostrarAviso('Não foi possível desfazer. Tente de novo.'),
                )
              }}
            >
              Desfazer
            </Botao>
          ) : !paga ? (
            <Botao
              variante="secundario"
              icone={Check}
              className="text-sm"
              carregando={pagar.isPending}
              onClick={() =>
                quandoTerminar(
                  pagar.mutateAsync({ divida, mes }),
                  () => mostrarAviso('Parcela marcada como paga.'),
                  () => mostrarAviso('Não foi possível marcar. Tente de novo.'),
                )
              }
            >
              Marcar como paga
            </Botao>
          ) : null)}
      </div>
    </Card>
  )
}

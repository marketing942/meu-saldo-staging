import {
  CalendarClock,
  CircleAlert,
  CreditCard,
  Eye,
  EyeOff,
  Receipt,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { Card, TituloCard } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { Inicial } from '@/components/ui/Inicial'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { cn } from '@/lib/cn'
import { useFaturasDoMes } from '@/lib/dados/cartoes'
import { useContas } from '@/lib/dados/contas'
import { useDividasDoMes } from '@/lib/dados/dividas'
import { primeiroNome, useAtualizarPerfil, usePerfil } from '@/lib/dados/perfil'
import { type ResumoMes, useResumoMes } from '@/lib/dados/resumo'
import { diaDe, formatarNomeMes } from '@/lib/datas'
import { useComMes, useMes } from '@/lib/mes'
import { nivelDoPercentual } from '@/lib/regras/resumo'
import { useFormatarValor } from '@/lib/valores'
import { useUI } from '@/stores/ui'

export default function Inicio() {
  const mes = useMes()
  const resumo = useResumoMes(mes)
  const perfil = usePerfil()
  const formatar = useFormatarValor()
  const nome = primeiroNome(perfil.data)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Início</h1>

      {resumo.isPending ? (
        <Carregando rotulo="Carregando resumo do mês" className="flex flex-col gap-4">
          <Esqueleto className="h-36 w-full rounded-card" />
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
            <div className="flex items-start justify-between gap-3">
              <div>
                {nome && <p className="text-sm text-secundario">Olá, {nome}</p>}
                <TituloCard className={cn(nome && 'mt-1', 'text-texto')}>Saldo total</TituloCard>
              </div>
              <BotaoOcultarValores />
            </div>
            <p className="valor mt-1 text-3xl font-semibold">
              {formatar(resumo.data.saldo_total_centavos)}
            </p>
            <p className="mt-1 text-sm text-secundario">
              Sobra no mês:{' '}
              <span
                className={cn(
                  'valor font-semibold',
                  resumo.data.sobra_mes_centavos < 0 ? 'text-desnecessario' : 'text-necessario',
                )}
              >
                {formatar(resumo.data.sobra_mes_centavos)}
              </span>
            </p>
            <SaldoPorConta />
          </Card>

          <AlertaDesnecessarios resumo={resumo.data} />
          <Alertas />
          <Lembrete resumo={resumo.data} lembrar={perfil.data?.lembrete_diario ?? true} />

          {resumo.data.gastos_mes_centavos === 0 &&
          resumo.data.receitas_mes_centavos === 0 &&
          resumo.data.dividas_total_centavos === 0 ? (
            <EstadoVazio
              icone={Receipt}
              titulo={`Nada lançado em ${formatarNomeMes(mes)}`}
              descricao="Lance uma receita ou um gasto para ver o resumo do mês aqui."
              acao={<LinkBotao to="/gastos/novo">Lançar primeiro gasto</LinkBotao>}
            />
          ) : (
            <>
              <NecessarioDesnecessario resumo={resumo.data} />
              <div className="grid grid-cols-2 gap-4">
                <CardTotal
                  titulo="Gastos do mês"
                  para="/gastos"
                  valor={resumo.data.gastos_mes_centavos}
                />
                <CardTotal
                  titulo="Receitas do mês"
                  para="/receitas"
                  valor={resumo.data.receitas_mes_centavos}
                />
              </div>
              {resumo.data.pode_gastar_dia_centavos !== null && (
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <TituloCard>Pode gastar por dia</TituloCard>
                    <p className="text-xs text-secundario">
                      {resumo.data.dias_restantes} dias até o fim do mês, contando hoje
                    </p>
                  </div>
                  <p
                    className={cn(
                      'valor text-xl font-semibold',
                      resumo.data.pode_gastar_dia_centavos < 0
                        ? 'text-desnecessario'
                        : 'text-necessario',
                    )}
                  >
                    {formatar(resumo.data.pode_gastar_dia_centavos)}
                  </p>
                </Card>
              )}
            </>
          )}

          <CardDividas resumo={resumo.data} />
          <Cartoes />
          <ProximosVencimentos />
        </>
      )}
    </div>
  )
}

function CardTotal({ titulo, para, valor }: { titulo: string; para: string; valor: number }) {
  const comMes = useComMes()
  const formatar = useFormatarValor()
  return (
    <Link
      to={comMes(para)}
      className="block rounded-card border border-borda bg-card p-4 hover:bg-fundo"
    >
      <span className="block text-sm font-medium text-secundario">{titulo}</span>
      <span className="valor mt-1 block text-xl font-semibold">{formatar(valor)}</span>
    </Link>
  )
}

function BotaoOcultarValores() {
  const ocultar = useUI((estado) => estado.ocultarValores)
  const definir = useUI((estado) => estado.definirOcultarValores)
  const atualizarPerfil = useAtualizarPerfil()
  return (
    <Botao
      variante="texto"
      icone={ocultar ? Eye : EyeOff}
      className="-mr-2 text-sm"
      onClick={() => {
        definir(!ocultar)
        atualizarPerfil.mutate({ ocultar_valores: !ocultar })
      }}
    >
      {ocultar ? 'Mostrar valores' : 'Ocultar valores'}
    </Botao>
  )
}

function SaldoPorConta() {
  const contas = useContas()
  const formatar = useFormatarValor()
  if (!contas.data || contas.data.length < 2) return null
  return (
    <ul className="mt-3 flex flex-col gap-1 border-t border-borda pt-3 text-sm">
      {contas.data.map((conta) => (
        <li key={conta.conta_id} className="flex justify-between gap-3">
          <span className="text-secundario">{conta.nome}</span>
          <span className="valor">{formatar(conta.saldo_centavos)}</span>
        </li>
      ))}
    </ul>
  )
}

function AlertaDesnecessarios({ resumo }: { resumo: ResumoMes }) {
  const formatar = useFormatarValor()
  const meta = resumo.meta_desnecessario_centavos
  const pct = resumo.desnecessario_percentual
  const nivel = nivelDoPercentual(pct)
  if (meta === null || pct === null || nivel === 'sem-meta') return null

  const dias = resumo.desnecessario_dias_para_estourar
  if (nivel === 'ok') {
    if (dias === null) return null
    return (
      <Alerta tom="alerta" icone={TriangleAlert} titulo="Ritmo acima da meta">
        No ritmo atual, os gastos desnecessários passam da meta de {formatar(meta)} em ~{dias}{' '}
        {dias === 1 ? 'dia' : 'dias'}.
      </Alerta>
    )
  }
  const estourou = nivel === 'estourou'
  return (
    <Alerta
      tom={estourou ? 'desnecessario' : 'alerta'}
      icone={estourou ? CircleAlert : TriangleAlert}
      titulo={estourou ? 'Você ultrapassou sua meta' : 'Atenção aos gastos desnecessários'}
    >
      {estourou
        ? `Os desnecessários somam ${formatar(resumo.desnecessario_centavos)}, ${formatar(resumo.desnecessario_centavos - meta)} acima da meta de ${formatar(meta)}.`
        : `Você já usou ${Math.round(pct)}% da meta de ${formatar(meta)}.`}
      {!estourou && dias !== null && ` No ritmo atual, passa da meta em ~${dias} dias.`}
    </Alerta>
  )
}

/** Dívidas atrasadas e faturas fechadas perto do vencimento. */
function Alertas() {
  const mes = useMes()
  const comMes = useComMes()
  const formatar = useFormatarValor()
  const dividas = useDividasDoMes(mes)
  const faturas = useFaturasDoMes(mes)

  const atrasadas = dividas.data?.filter((d) => d.status === 'atrasada') ?? []
  const vencendo =
    faturas.data?.filter(
      (f) =>
        f.status === 'fechada' &&
        f.total_centavos > 0 &&
        f.dias_para_vencer >= 0 &&
        f.dias_para_vencer <= 5,
    ) ?? []

  return (
    <>
      {atrasadas.length > 0 && (
        <Alerta
          tom="desnecessario"
          icone={CircleAlert}
          titulo={
            atrasadas.length === 1 ? '1 dívida atrasada' : `${atrasadas.length} dívidas atrasadas`
          }
          acao={
            <Link to={comMes('/dividas')} className="text-sm font-medium text-destaque underline">
              Ver dívidas
            </Link>
          }
        >
          {atrasadas
            .slice(0, 3)
            .map((d) => `${d.nome} (${formatar(d.valor_centavos)})`)
            .join(', ')}
        </Alerta>
      )}
      {vencendo.map((f) => (
        <Alerta
          key={f.cartao_id}
          tom="alerta"
          icone={CreditCard}
          titulo={`Fatura ${f.nome}: ${formatar(f.total_centavos)}`}
          acao={
            <Link
              to={comMes(`/cartoes/${f.cartao_id}`)}
              className="text-sm font-medium text-destaque underline"
            >
              Ver fatura
            </Link>
          }
        >
          {f.dias_para_vencer === 0
            ? 'Vence hoje.'
            : `Vence em ${f.dias_para_vencer} ${f.dias_para_vencer === 1 ? 'dia' : 'dias'}.`}
        </Alerta>
      ))}
    </>
  )
}

function Lembrete({ resumo, lembrar }: { resumo: ResumoMes; lembrar: boolean }) {
  if (!lembrar || resumo.situacao !== 'atual' || resumo.lancou_hoje) return null
  return (
    <Card className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm">
        <CalendarClock aria-hidden size={18} className="shrink-0 text-destaque" />
        Você ainda não lançou nada hoje.
      </p>
      <LinkBotao to="/gastos/novo" variante="secundario" className="shrink-0 px-4 text-sm">
        Lançar agora
      </LinkBotao>
    </Card>
  )
}

function NecessarioDesnecessario({ resumo }: { resumo: ResumoMes }) {
  const formatar = useFormatarValor()
  const necessario = resumo.necessario_centavos
  const desnecessario = resumo.desnecessario_centavos
  const total = necessario + desnecessario
  const pctNecessario = total > 0 ? Math.round((necessario * 100) / total) : 0
  const meta = resumo.meta_desnecessario_centavos
  const pctMeta = resumo.desnecessario_percentual
  const nivel = nivelDoPercentual(pctMeta)

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
          <dd className="valor mt-0.5 text-base font-semibold">{formatar(necessario)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-secundario">
            <span aria-hidden className="size-2 rounded-full bg-desnecessario" />
            Desnecessário
          </dt>
          <dd className="valor mt-0.5 text-base font-semibold">{formatar(desnecessario)}</dd>
        </div>
      </dl>
      {meta !== null && pctMeta !== null && (
        <div className="mt-4 flex flex-col gap-1.5">
          <BarraProgresso
            rotulo="Uso da meta de desnecessários"
            percentual={pctMeta}
            cor={
              nivel === 'estourou'
                ? 'bg-desnecessario'
                : nivel === 'ok'
                  ? 'bg-necessario'
                  : 'bg-alerta'
            }
          />
          <p className="text-sm text-secundario">
            Meta de desnecessários: {formatar(meta)} · {Math.round(pctMeta)}% usado
          </p>
        </div>
      )}
    </Card>
  )
}

function CardDividas({ resumo }: { resumo: ResumoMes }) {
  const comMes = useComMes()
  const formatar = useFormatarValor()
  if (resumo.dividas_total_centavos === 0) return null
  return (
    <Link to={comMes('/dividas')} className="block rounded-card focus-visible:outline-2">
      <Card className="hover:bg-fundo">
        <TituloCard>Dívidas do mês</TituloCard>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="valor text-xl font-semibold">
            {formatar(resumo.dividas_total_centavos)}
          </span>
          <span className="text-sm text-secundario">
            falta pagar{' '}
            <span className="valor font-semibold text-desnecessario">
              {formatar(resumo.dividas_pendentes_centavos)}
            </span>
          </span>
        </div>
      </Card>
    </Link>
  )
}

function Cartoes() {
  const mes = useMes()
  const comMes = useComMes()
  const formatar = useFormatarValor()
  const faturas = useFaturasDoMes(mes)
  if (!faturas.data || faturas.data.length === 0) return null
  return (
    <section aria-labelledby="titulo-cartoes" className="flex flex-col gap-2">
      <h2 id="titulo-cartoes" className="text-sm font-medium text-secundario">
        Faturas que fecham em {formatarNomeMes(mes)}
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {faturas.data.map((f) => (
          <li key={f.cartao_id} className="w-60 shrink-0 snap-start">
            <Link
              to={comMes(`/cartoes/${f.cartao_id}`)}
              className="block h-full rounded-card border border-borda bg-card p-4 hover:bg-fundo"
            >
              <span className="flex items-center gap-2 text-sm text-secundario">
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ backgroundColor: f.cor }}
                />
                {f.nome}
              </span>
              <span className="valor mt-1 block text-xl font-semibold">
                {formatar(f.total_centavos)}
              </span>
              <span className="mt-1 block text-xs text-secundario">
                Limite usado {Math.round(f.limite_percentual)}% · vence dia{' '}
                {diaDe(f.data_vencimento)}
                {f.status === 'paga' && ' · paga'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProximosVencimentos() {
  const mes = useMes()
  const comMes = useComMes()
  const formatar = useFormatarValor()
  const dividas = useDividasDoMes(mes)
  const pendentes = (dividas.data ?? []).filter((d) => d.status !== 'paga').slice(0, 3)
  if (pendentes.length === 0) return null
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <TituloCard>Próximos vencimentos</TituloCard>
        <Link
          to={comMes('/dividas')}
          className="text-sm font-medium text-destaque underline-offset-4 hover:underline"
        >
          Ver todas
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-borda">
        {pendentes.map((d) => (
          <li key={d.divida_id} className="flex items-center gap-3 py-2.5">
            <Inicial nome={d.nome} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.nome}</p>
              <p
                className={cn(
                  'text-sm',
                  d.status === 'atrasada' ? 'text-desnecessario' : 'text-secundario',
                )}
              >
                {d.status === 'atrasada' ? 'Atrasada · ' : ''}vence dia {diaDe(d.data_vencimento)}
              </p>
            </div>
            <span className="valor shrink-0 font-semibold">{formatar(d.valor_centavos)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

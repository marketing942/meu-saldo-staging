import { CalendarClock, CircleAlert, Info, Trash2, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'

import { CampoConta, GrupoEscolha } from '@/components/formularios/CamposComuns'
import { lerDia } from '@/components/formularios/lerDia'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { Interruptor } from '@/components/ui/Interruptor'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { Pilula } from '@/components/ui/Pilula'
import { Selecao } from '@/components/ui/Selecao'
import { type Cartao, useCartoes, useLimiteCartao } from '@/lib/dados/cartoes'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { desfazerCom } from '@/lib/dados/desfazer'
import {
  type Divida,
  ROTULO_TIPO_DIVIDA,
  dividaParaCalculo,
  restaurarDivida,
  useDivida,
  useExcluirDivida,
  usePagamentosDivida,
  useSalvarDivida,
} from '@/lib/dados/dividas'
import { mesAtual } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useVoltar } from '@/lib/navegacao'
import { disponivelDepoisDaConta } from '@/lib/regras/cartao'
import { saldoDevedorContaAPagar } from '@/lib/regras/dividas'
import { useUsuario } from '@/lib/sessao'
import type { Enums } from '@/lib/supabase'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

/** Conta a pagar: /contas-a-pagar/nova e /contas-a-pagar/:dividaId (editar). */
export default function FormDivida() {
  const { dividaId } = useParams()
  const contas = useContas()
  const cartoes = useCartoes()
  const divida = useDivida(dividaId)
  const editando = Boolean(dividaId)
  const consultas = [contas, cartoes, ...(editando ? [divida] : [])]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        {editando ? 'Editar conta a pagar' : 'Nova conta a pagar'}
      </h1>
      {consultas.some((c) => c.isPending) ? (
        <Carregando rotulo="Carregando formulário">
          <Esqueleto className="h-[30rem] w-full rounded-card" />
        </Carregando>
      ) : consultas.some((c) => c.isError) ? (
        <EstadoErro
          erro={consultas.find((c) => c.isError)?.error}
          aoTentarDeNovo={() => consultas.forEach((c) => void c.refetch())}
        />
      ) : editando && !divida.data ? (
        <EstadoVazio
          icone={CalendarClock}
          titulo="Conta a pagar não encontrada"
          descricao="Ela pode ter sido excluída."
          acao={<LinkBotao to="/contas-a-pagar">Ver contas a pagar</LinkBotao>}
        />
      ) : (
        <Formulario
          original={divida.data ?? null}
          contas={contas.data ?? []}
          cartoes={cartoes.data ?? []}
        />
      )}
    </div>
  )
}

interface Erros {
  nome?: string
  valor?: string
  dia?: string
  total?: string
  jaPagas?: string
  conta?: string
  limite?: string
}

function Formulario({
  original,
  contas,
  cartoes,
}: {
  original: Divida | null
  contas: { conta_id: string; nome: string }[]
  cartoes: Cartao[]
}) {
  const voltar = useVoltar('/contas-a-pagar')
  const { id: uid } = useUsuario()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const salvarDivida = useSalvarDivida()
  const excluir = useExcluirDivida()
  const cartoesVisiveis = cartoes.filter((c) => !c.arquivado || c.id === original?.cartao_id)

  const [infinita, setInfinita] = useState(original?.infinita ?? false)
  const [nome, setNome] = useState(original?.nome ?? '')
  const [tipo, setTipo] = useState<Enums['tipo_divida']>(original?.tipo ?? 'financiamento')
  const [valor, setValor] = useState(original?.valor_parcela_centavos ?? 0)
  const [dia, setDia] = useState(String(original?.dia_vencimento ?? ''))
  const [total, setTotal] = useState(String(original?.total_parcelas ?? ''))
  const [jaPagas, setJaPagas] = useState(String(original?.parcelas_ja_pagas ?? '0'))
  const [forma, setForma] = useState<Enums['forma_pagamento']>(original?.forma_pagamento ?? 'conta')
  const [contaEscolhida, setContaEscolhida] = useState(original?.conta_id ?? '')
  const [cartaoId, setCartaoId] = useState(original?.cartao_id ?? cartoesVisiveis[0]?.id ?? '')
  const [ativa, setAtiva] = useState(original?.ativa ?? true)
  const [acimaDoLimiteConfirmado, setAcimaDoLimiteConfirmado] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const formatar = useFormatarValor()

  const contaId = contaEscolhida || contaPadrao(contas)?.conta_id || ''
  const totalNum = Number(total)
  const jaPagasNum = Number(jaPagas || '0')
  const previa =
    !infinita && Number.isInteger(totalNum) && totalNum > 0 && jaPagasNum < totalNum
      ? `Restam ${totalNum - jaPagasNum} parcelas · saldo devedor ${formatarCentavos((totalNum - jaPagasNum) * valor)}`
      : null

  // Limite do cartão: a conta compromete o saldo devedor ainda não quitado
  // (parcelada: todas as parcelas que faltam; recorrente: a parcela do mês).
  const cartao = forma === 'cartao' ? cartoesVisiveis.find((c) => c.id === cartaoId) : undefined
  const limite = useLimiteCartao(cartao?.id)
  const pagamentos = usePagamentosDivida(original?.id)
  const mesesPagos = pagamentos.data?.map((p) => p.mes_ref) ?? []
  const hojeMes = mesAtual()
  const numerosValidos =
    infinita ||
    (Number.isInteger(totalNum) &&
      totalNum >= 1 &&
      totalNum <= 600 &&
      Number.isInteger(jaPagasNum) &&
      jaPagasNum >= 0 &&
      jaPagasNum < totalNum)
  // Como o gatilho dividas_preparar: mudar total, já pagas ou tipo recomeça a contagem neste mês.
  const recomecaContagem =
    !original ||
    original.infinita !== infinita ||
    original.total_parcelas !== (infinita ? null : totalNum) ||
    original.parcelas_ja_pagas !== (infinita ? 0 : jaPagasNum)
  const comprometeCentavos =
    cartao && valor > 0 && numerosValidos
      ? saldoDevedorContaAPagar(
          {
            infinita,
            totalParcelas: infinita ? null : totalNum,
            parcelasJaPagas: infinita ? 0 : jaPagasNum,
            mesInicioRef: recomecaContagem || !original ? hojeMes : original.mes_inicio_ref,
            diaVencimento: lerDia(dia) ?? 1,
            valorParcelaCentavos: valor,
            ativa,
          },
          original ? mesesPagos : [],
          hojeMes,
        )
      : 0
  // Na edição no mesmo cartão, o que a conta já ocupa volta antes de comparar.
  const jaOcupadoNoCartao =
    original && cartao && original.forma_pagamento === 'cartao' && original.cartao_id === cartao.id
      ? saldoDevedorContaAPagar(dividaParaCalculo(original), mesesPagos, hojeMes)
      : 0
  const disponivelHoje = limite.data?.disponivel_centavos ?? null
  const disponivelDepois =
    disponivelHoje === null
      ? null
      : disponivelDepoisDaConta(disponivelHoje, comprometeCentavos, jaOcupadoNoCartao)
  const passaDoLimite =
    disponivelDepois !== null && disponivelDepois < 0 && comprometeCentavos > jaOcupadoNoCartao

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const diaNum = lerDia(dia)
    const novosErros: Erros = {
      nome: nome.trim() ? undefined : 'Dê um nome à conta a pagar.',
      valor: valor > 0 ? undefined : 'Informe o valor da parcela.',
      dia: diaNum ? undefined : 'Dia de 1 a 31.',
      total:
        infinita || (Number.isInteger(totalNum) && totalNum >= 1 && totalNum <= 600)
          ? undefined
          : 'De 1 a 600 parcelas.',
      jaPagas:
        infinita || (Number.isInteger(jaPagasNum) && jaPagasNum >= 0 && jaPagasNum < totalNum)
          ? undefined
          : 'Precisa ser menor que o total.',
      conta:
        forma === 'conta' && !contaId
          ? 'Escolha a carteira.'
          : forma === 'cartao' && !cartao
            ? 'Escolha o cartão.'
            : undefined,
      limite:
        passaDoLimite && !acimaDoLimiteConfirmado
          ? 'Confirme que quer salvar a conta acima do limite.'
          : undefined,
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean) || !diaNum) return
    try {
      await salvarDivida.mutateAsync({
        id: original?.id,
        nome: nome.trim(),
        tipo,
        valor_parcela_centavos: valor,
        dia_vencimento: diaNum,
        infinita,
        total_parcelas: infinita ? null : totalNum,
        parcelas_ja_pagas: infinita ? 0 : jaPagasNum,
        forma_pagamento: forma,
        conta_id: forma === 'conta' ? contaId : null,
        cartao_id: forma === 'cartao' ? cartaoId : null,
        ativa,
      })
      mostrarAviso(original ? 'Conta a pagar atualizada.' : 'Conta a pagar salva.')
      voltar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  async function remover() {
    if (!original) return
    try {
      await excluir.mutateAsync(original.id)
      voltar()
      mostrarAviso('Conta excluída de todos os meses.', {
        rotulo: 'Desfazer',
        executar: desfazerCom(() => restaurarDivida(uid, original.id)),
      })
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  const erroGravacao = salvarDivida.error ?? excluir.error

  return (
    <Card>
      <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
        {erroGravacao && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(erroGravacao)}
          </Alerta>
        )}
        <GrupoEscolha legenda="Tipo de cobrança">
          <Pilula ativa={!infinita} onClick={() => setInfinita(false)}>
            Parcelada
          </Pilula>
          <Pilula ativa={infinita} onClick={() => setInfinita(true)}>
            Recorrente ∞
          </Pilula>
        </GrupoEscolha>
        <Campo
          rotulo="Nome"
          placeholder="Ex.: Financiamento do carro"
          maxLength={60}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
        />
        <Selecao
          rotulo="Categoria da conta a pagar"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Enums['tipo_divida'])}
        >
          {Object.entries(ROTULO_TIPO_DIVIDA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <CampoValor
            rotulo="Valor da parcela (R$)"
            centavos={valor}
            aoMudar={setValor}
            erro={erros.valor}
          />
          <Campo
            rotulo="Dia do venc."
            inputMode="numeric"
            maxLength={2}
            className="w-28"
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))}
            erro={erros.dia}
          />
        </div>
        {infinita ? (
          <p className="text-sm text-secundario">
            Sem data final: entra todo mês, a partir deste, até você encerrar (assinaturas, aluguel,
            condomínio).
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                rotulo="Total de parcelas"
                inputMode="numeric"
                maxLength={3}
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))}
                erro={erros.total}
              />
              <Campo
                rotulo="Já paguei"
                inputMode="numeric"
                maxLength={3}
                value={jaPagas}
                onChange={(e) => setJaPagas(e.target.value.replace(/\D/g, ''))}
                erro={erros.jaPagas}
              />
            </div>
            <p className="-mt-2 text-sm text-secundario">
              {previa ?? 'Informe o total e quantas você já pagou.'}
            </p>
          </>
        )}
        {original && (
          <Alerta tom="destaque" icone={Info}>
            Ao mudar o total de parcelas, as já pagas ou o tipo de cobrança, a contagem recomeça
            neste mês. Mudar o valor só afeta as parcelas ainda não pagas.
          </Alerta>
        )}

        <GrupoEscolha legenda="Como você paga?">
          <Pilula ativa={forma === 'conta'} onClick={() => setForma('conta')}>
            Carteira
          </Pilula>
          <Pilula
            ativa={forma === 'cartao'}
            disabled={cartoesVisiveis.length === 0}
            className={cartoesVisiveis.length === 0 ? 'opacity-50' : undefined}
            onClick={() => setForma('cartao')}
          >
            Cartão de crédito
          </Pilula>
        </GrupoEscolha>
        {forma === 'conta' ? (
          contas.length > 0 && (
            <CampoConta
              rotulo="Sai da carteira"
              contas={contas}
              valor={contaId}
              aoMudar={setContaEscolhida}
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            <Selecao
              rotulo="Cartão"
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value)}
              erro={erros.conta}
            >
              {cartoesVisiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
            {cartao && disponivelHoje !== null && disponivelDepois !== null && (
              <div className="flex flex-col gap-1 rounded-campo border border-borda p-3 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-secundario">Limite disponível hoje:</span>{' '}
                  <span className="valor font-medium">{formatar(disponivelHoje)}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-secundario">Esta conta comprometerá:</span>{' '}
                  <span className="valor font-medium">{formatar(comprometeCentavos)}</span>
                </p>
                <p className="flex justify-between gap-3 font-medium">
                  <span>Disponível após {original ? 'salvar' : 'lançamento'}:</span>{' '}
                  <span className={disponivelDepois < 0 ? 'valor text-desnecessario' : 'valor'}>
                    {formatar(disponivelDepois)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-secundario">
                  {infinita
                    ? 'Recorrente: ocupa a parcela do mês até ela ser marcada como paga.'
                    : 'Parcelada: ocupa todas as parcelas que faltam; cada parcela marcada como paga libera o valor dela.'}
                </p>
              </div>
            )}
            {passaDoLimite && disponivelHoje !== null && disponivelDepois !== null && (
              <Alerta
                tom="alerta"
                icone={TriangleAlert}
                anunciar
                titulo={`Esta conta passa do limite disponível (${formatar(disponivelHoje + jaOcupadoNoCartao)})`}
              >
                <p>
                  Ela passa {formatar(-disponivelDepois)} do limite do cartão. Você pode salvar
                  mesmo assim.
                </p>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={acimaDoLimiteConfirmado}
                    onChange={(e) => setAcimaDoLimiteConfirmado(e.target.checked)}
                    className="size-5 accent-[var(--destaque)]"
                  />
                  Salvar mesmo assim
                </label>
                {erros.limite && !acimaDoLimiteConfirmado && (
                  <p className="mt-1 text-desnecessario">{erros.limite}</p>
                )}
              </Alerta>
            )}
          </div>
        )}
        {erros.conta && forma === 'conta' && (
          <p className="text-sm text-desnecessario">{erros.conta}</p>
        )}

        {original && (
          <Interruptor
            rotulo="Conta ativa"
            descricao="Desligue para encerrar: ela some dos próximos meses e o histórico fica."
            ligado={ativa}
            aoMudar={setAtiva}
          />
        )}

        <div className="mt-2 flex flex-col gap-2">
          <Botao type="submit" larguraTotal carregando={salvarDivida.isPending}>
            {original ? 'Salvar alterações' : 'Salvar conta a pagar'}
          </Botao>
          <Botao variante="texto" onClick={voltar}>
            Cancelar
          </Botao>
          {original && (
            <ConfirmarAcao
              rotulo="Excluir conta a pagar"
              icone={Trash2}
              pergunta="Excluir esta conta a pagar de todos os meses, inclusive o histórico de pagamentos?"
              rotuloConfirmar="Excluir"
              carregando={excluir.isPending}
              aoConfirmar={() => void remover()}
            />
          )}
        </div>
      </form>
    </Card>
  )
}

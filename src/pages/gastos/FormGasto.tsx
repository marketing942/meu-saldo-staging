import { CircleAlert, Info, Receipt, Sparkles, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'

import { CampoConta, GrupoEscolha } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { Pilula } from '@/components/ui/Pilula'
import { Selecao } from '@/components/ui/Selecao'
import { type Cartao, useCartoes } from '@/lib/dados/cartoes'
import { type Categoria, useCategorias } from '@/lib/dados/categorias'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import {
  type Gasto,
  useCriarGasto,
  useEditarGasto,
  useExcluirGasto,
  restaurarGastos,
  useGasto,
  useSugestaoCategoria,
} from '@/lib/dados/gastos'
import { desfazerCom } from '@/lib/dados/desfazer'
import { dataValida, formatarMesAno, hoje } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useVoltar } from '@/lib/navegacao'
import { useUsuario } from '@/lib/sessao'
import { PARCELAS_MAXIMO, gerarParcelas, mesFatura } from '@/lib/regras/cartao'
import type { Enums } from '@/lib/supabase'
import { useAtrasado } from '@/lib/useAtrasado'
import { useAvisos } from '@/stores/avisos'

import { ROTULO_TIPO } from './rotulos'

type Origem = Enums['origem_gasto']
type Tipo = Enums['tipo_gasto']

/** /gastos/novo e /gastos/:gastoId (editar). */
export default function FormGasto() {
  const { gastoId } = useParams()
  const contas = useContas()
  const cartoes = useCartoes()
  const categorias = useCategorias()
  const gasto = useGasto(gastoId)
  const editando = Boolean(gastoId)

  const consultas = [contas, cartoes, categorias, ...(editando ? [gasto] : [])]
  const pendente = consultas.some((c) => c.isPending)
  const comErro = consultas.find((c) => c.isError)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{editando ? 'Editar gasto' : 'Novo gasto'}</h1>
      {pendente ? (
        <Carregando rotulo="Carregando formulário">
          <Esqueleto className="h-[28rem] w-full rounded-card" />
        </Carregando>
      ) : comErro ? (
        <EstadoErro
          erro={comErro.error}
          aoTentarDeNovo={() => consultas.forEach((c) => void c.refetch())}
        />
      ) : editando && !gasto.data ? (
        <EstadoVazio
          icone={Receipt}
          titulo="Gasto não encontrado"
          descricao="Ele pode ter sido excluído."
          acao={<LinkBotao to="/gastos">Voltar para Gastos</LinkBotao>}
        />
      ) : !contas.data || contas.data.length === 0 ? (
        <Alerta tom="alerta" icone={CircleAlert} titulo="Nenhuma conta encontrada">
          Cadastre uma conta em <Link to="/configuracoes/contas">Configurações › Contas</Link>.
        </Alerta>
      ) : (
        <Formulario
          original={gasto.data ?? null}
          contas={contas.data}
          cartoes={cartoes.data ?? []}
          categorias={categorias.data ?? []}
        />
      )}
    </div>
  )
}

interface Erros {
  descricao?: string
  valor?: string
  data?: string
  tipo?: string
  cartao?: string
}

function Formulario({
  original,
  contas,
  cartoes,
  categorias,
}: {
  original: Gasto | null
  contas: { conta_id: string; nome: string }[]
  cartoes: Cartao[]
  categorias: Categoria[]
}) {
  const voltar = useVoltar('/gastos')
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const criar = useCriarGasto()
  const editar = useEditarGasto()
  const excluir = useExcluirGasto()
  const { id: uid } = useUsuario()

  const parcelado = (original?.total_parcelas ?? 1) > 1
  const cartoesVisiveis = cartoes.filter((c) => !c.arquivado || c.id === original?.cartao_id)

  const [descricao, setDescricao] = useState(original?.descricao ?? '')
  const [centavos, setCentavos] = useState(original?.valor_centavos ?? 0)
  const [data, setData] = useState(original?.data ?? hoje())
  const [origem, setOrigem] = useState<Origem>(original?.origem ?? 'pix')
  const [cartaoId, setCartaoId] = useState(original?.cartao_id ?? cartoesVisiveis[0]?.id ?? '')
  const [parcelas, setParcelas] = useState(1)
  const [contaEscolhida, setContaEscolhida] = useState(original?.conta_id ?? '')
  // undefined = o usuário ainda não escolheu (vale a sugestão); null = "sem categoria".
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<string | null | undefined>(
    original ? original.categoria_id : undefined,
  )
  const [tipoEscolhido, setTipoEscolhido] = useState<Tipo | undefined>(original?.tipo)
  const [erros, setErros] = useState<Erros>({})

  const sugestao = useSugestaoCategoria(useAtrasado(original ? '' : descricao))
  const sugestaoValida =
    sugestao.data && categorias.some((c) => c.id === sugestao.data?.categoria_id)
      ? sugestao.data
      : null
  const categoriaId =
    categoriaEscolhida !== undefined ? categoriaEscolhida : (sugestaoValida?.categoria_id ?? null)
  const tipo = tipoEscolhido ?? sugestaoValida?.tipo
  const usandoSugestao =
    sugestaoValida !== null && (categoriaEscolhida === undefined || tipoEscolhido === undefined)

  const contaId = contaEscolhida || contaPadrao(contas)?.conta_id || ''
  const cartao = cartoesVisiveis.find((c) => c.id === cartaoId)
  const totalParcelas = origem === 'cartao' && !original ? parcelas : 1
  const travado = parcelado // compra parcelada: só descrição, categoria e tipo mudam

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const texto = descricao.trim()
    const novosErros: Erros = {
      descricao: texto ? undefined : 'Descreva o gasto.',
      valor:
        centavos <= 0
          ? 'Digite um valor maior que zero.'
          : centavos < totalParcelas
            ? `Valor muito baixo para ${totalParcelas} parcelas.`
            : undefined,
      data: dataValida(data) ? undefined : 'Escolha uma data válida.',
      tipo: tipo ? undefined : 'Escolha se foi necessário ou desnecessário.',
      cartao: origem === 'cartao' && !cartao ? 'Escolha o cartão.' : undefined,
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean) || !tipo) return

    const dados = {
      descricao: texto,
      valor_centavos: centavos,
      data,
      origem,
      tipo,
      conta_id: origem === 'cartao' ? null : contaId,
      cartao_id: origem === 'cartao' ? cartaoId : null,
      categoria_id: categoriaId,
      total_parcelas: totalParcelas,
    }
    try {
      if (original) await editar.mutateAsync({ original, novo: dados })
      else await criar.mutateAsync(dados)
      mostrarAviso(original ? 'Gasto atualizado.' : 'Gasto salvo.')
      voltar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  async function remover() {
    if (!original) return
    try {
      const ids = await excluir.mutateAsync(original)
      voltar()
      mostrarAviso(ids.length > 1 ? `${ids.length} parcelas excluídas.` : 'Gasto excluído.', {
        rotulo: 'Desfazer',
        executar: desfazerCom(() => restaurarGastos(uid, ids)),
      })
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  const erroGravacao = criar.error ?? editar.error ?? excluir.error

  return (
    <Card>
      <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
        {erroGravacao && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(erroGravacao)}
          </Alerta>
        )}
        {travado && original && (
          <Alerta tom="destaque" icone={Info}>
            Compra parcelada em {original.total_parcelas}x (esta é a parcela{' '}
            {original.parcela_atual}). Descrição, categoria e tipo valem para todas as parcelas.
            Para mudar valor, data ou cartão, exclua e lance de novo.
          </Alerta>
        )}

        <CampoValor
          rotulo={totalParcelas > 1 ? 'Valor total da compra (R$)' : 'Valor (R$)'}
          centavos={centavos}
          aoMudar={setCentavos}
          erro={erros.valor}
          desabilitado={travado}
        />
        <Campo
          rotulo="Descrição"
          placeholder="O que foi? (ex.: Mercado, Uber)"
          maxLength={120}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao}
        />
        {usandoSugestao && sugestaoValida && (
          <p className="-mt-2 flex items-center gap-1.5 text-sm text-secundario">
            <Sparkles aria-hidden size={16} className="text-destaque" />
            Sugestão automática:{' '}
            {[
              categorias.find((c) => c.id === sugestaoValida.categoria_id)?.nome,
              ROTULO_TIPO[sugestaoValida.tipo],
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <GrupoEscolha legenda="Categoria">
          {categorias.map((c) => (
            <Pilula
              key={c.id}
              ativa={categoriaId === c.id}
              onClick={() => setCategoriaEscolhida(categoriaId === c.id ? null : c.id)}
            >
              <span
                aria-hidden
                className="mr-1.5 size-2.5 rounded-full"
                style={{ backgroundColor: c.cor }}
              />
              {c.nome}
            </Pilula>
          ))}
        </GrupoEscolha>

        <GrupoEscolha legenda="Como pagou?">
          {(['pix', 'dinheiro', 'cartao'] as const).map((opcao) => (
            <Pilula
              key={opcao}
              ativa={origem === opcao}
              disabled={travado}
              className={travado ? 'opacity-50' : undefined}
              onClick={() => setOrigem(opcao)}
            >
              {opcao === 'pix' ? 'Pix' : opcao === 'dinheiro' ? 'Dinheiro' : 'Cartão'}
            </Pilula>
          ))}
        </GrupoEscolha>

        {origem === 'cartao' ? (
          cartoesVisiveis.length === 0 ? (
            <Alerta tom="alerta" icone={Info} titulo="Nenhum cartão cadastrado">
              <Link to="/configuracoes/cartoes" className="font-medium text-destaque underline">
                Cadastre um cartão
              </Link>{' '}
              para lançar compras no crédito.
            </Alerta>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Selecao
                  rotulo="Cartão"
                  value={cartaoId}
                  onChange={(e) => setCartaoId(e.target.value)}
                  disabled={travado}
                  erro={erros.cartao}
                >
                  {cartoesVisiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Selecao>
                {!original && (
                  <Selecao
                    rotulo="Parcelas"
                    value={parcelas}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                  >
                    {Array.from({ length: PARCELAS_MAXIMO }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'À vista' : `${n}x`}
                      </option>
                    ))}
                  </Selecao>
                )}
              </div>
              {cartao && dataValida(data) && (
                <p className="text-sm text-secundario">
                  {resumoParcelas(centavos, data, totalParcelas)}Entra na fatura que fecha em{' '}
                  {formatarMesAno(mesFatura(data, cartao.dia_fechamento))}.
                </p>
              )}
            </div>
          )
        ) : (
          <CampoConta
            rotulo="Sai da conta"
            contas={contas}
            valor={contaId}
            aoMudar={setContaEscolhida}
            desabilitado={travado}
          />
        )}

        <Campo
          rotulo={totalParcelas > 1 ? 'Data da compra (1ª parcela)' : 'Data'}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          erro={erros.data}
          disabled={travado}
        />

        <GrupoEscolha legenda="Esse gasto foi..." erro={erros.tipo}>
          {(['necessario', 'desnecessario'] as const).map((opcao) => (
            <Pilula key={opcao} ativa={tipo === opcao} onClick={() => setTipoEscolhido(opcao)}>
              {ROTULO_TIPO[opcao]}
            </Pilula>
          ))}
        </GrupoEscolha>

        <div className="mt-2 flex flex-col gap-2">
          <Botao type="submit" larguraTotal carregando={criar.isPending || editar.isPending}>
            {original ? 'Salvar alterações' : 'Salvar gasto'}
          </Botao>
          <Botao variante="texto" onClick={voltar}>
            Cancelar
          </Botao>
          {original && (
            <ConfirmarAcao
              rotulo={parcelado ? 'Excluir compra' : 'Excluir gasto'}
              icone={Trash2}
              pergunta={
                parcelado
                  ? `Excluir as ${original.total_parcelas} parcelas desta compra?`
                  : 'Excluir este gasto?'
              }
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

function resumoParcelas(centavos: number, data: string, total: number): string {
  if (total <= 1 || centavos < total) return ''
  const [primeira, segunda] = gerarParcelas(centavos, data, total)
  if (!primeira || !segunda) return ''
  return primeira.valorCentavos === segunda.valorCentavos
    ? `${total}x de ${formatarCentavos(primeira.valorCentavos)}. `
    : `${total}x: 1ª de ${formatarCentavos(primeira.valorCentavos)} e as demais de ${formatarCentavos(segunda.valorCentavos)}. `
}

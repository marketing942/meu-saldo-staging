import { Archive, ArchiveRestore, CircleAlert, CreditCard, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { SeletorCor } from '@/components/formularios/CamposComuns'
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
import { quandoTerminar } from '@/lib/dados/comum'
import {
  type Cartao,
  useArquivarCartao,
  useCartoes,
  useExcluirCartao,
  useSalvarCartao,
} from '@/lib/dados/cartoes'
import { mensagemAoExcluir, mensagemDeErro } from '@/lib/erros'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

import { CabecalhoConfig } from './comum'

export default function Cartoes() {
  const cartoes = useCartoes()
  const [editando, setEditando] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoConfig
        titulo="Cartões"
        descricao="Limite, fechamento e vencimento de cada cartão de crédito."
        acao={
          editando !== 'novo' && (
            <Botao icone={Plus} onClick={() => setEditando('novo')}>
              Novo cartão
            </Botao>
          )
        }
      />
      {editando === 'novo' && <FormCartao aoTerminar={() => setEditando(null)} />}

      {cartoes.isPending ? (
        <Carregando rotulo="Carregando cartões">
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : cartoes.isError ? (
        <EstadoErro erro={cartoes.error} aoTentarDeNovo={() => void cartoes.refetch()} />
      ) : cartoes.data.length === 0 ? (
        editando !== 'novo' && (
          <EstadoVazio
            icone={CreditCard}
            titulo="Nenhum cartão cadastrado"
            descricao="Cadastre seus cartões para lançar compras no crédito e acompanhar as faturas."
            acao={<Botao onClick={() => setEditando('novo')}>Cadastrar cartão</Botao>}
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {cartoes.data.map((cartao) =>
            editando === cartao.id ? (
              <li key={cartao.id}>
                <FormCartao original={cartao} aoTerminar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={cartao.id}>
                <ItemCartao cartao={cartao} aoEditar={() => setEditando(cartao.id)} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function ItemCartao({ cartao, aoEditar }: { cartao: Cartao; aoEditar: () => void }) {
  const formatar = useFormatarValor()
  const arquivar = useArquivarCartao()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  return (
    <Card className={cartao.arquivado ? 'opacity-70' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: cartao.cor }}
            />
            {cartao.nome}
            {cartao.arquivado && <span className="text-xs text-secundario">(arquivado)</span>}
          </p>
          <p className="text-sm text-secundario">
            Limite {formatar(cartao.limite_centavos)} · fecha dia {cartao.dia_fechamento} · vence
            dia {cartao.dia_vencimento}
          </p>
        </div>
        <Botao variante="texto" className="shrink-0 text-sm" onClick={aoEditar}>
          Editar
        </Botao>
      </div>
      <div className="mt-2">
        <Botao
          variante="texto"
          className="text-sm"
          icone={cartao.arquivado ? ArchiveRestore : Archive}
          carregando={arquivar.isPending}
          onClick={() =>
            quandoTerminar(
              arquivar.mutateAsync({ id: cartao.id, arquivado: !cartao.arquivado }),
              () => mostrarAviso(cartao.arquivado ? 'Cartão reativado.' : 'Cartão arquivado.'),
            )
          }
        >
          {cartao.arquivado ? 'Reativar' : 'Arquivar'}
        </Botao>
      </div>
    </Card>
  )
}

interface Erros {
  nome?: string
  limite?: string
  fechamento?: string
  vencimento?: string
}

function FormCartao({ original, aoTerminar }: { original?: Cartao; aoTerminar: () => void }) {
  const salvarCartao = useSalvarCartao()
  const excluir = useExcluirCartao()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [nome, setNome] = useState(original?.nome ?? '')
  const [cor, setCor] = useState(original?.cor ?? '#2E4A7A')
  const [limite, setLimite] = useState(original?.limite_centavos ?? 0)
  const [fechamento, setFechamento] = useState(String(original?.dia_fechamento ?? ''))
  const [vencimento, setVencimento] = useState(String(original?.dia_vencimento ?? ''))
  const [erros, setErros] = useState<Erros>({})

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const diaFechamento = lerDia(fechamento)
    const diaVencimento = lerDia(vencimento)
    const novosErros: Erros = {
      nome: nome.trim() ? undefined : 'Dê um nome ao cartão.',
      limite: limite > 0 ? undefined : 'Informe o limite.',
      fechamento: diaFechamento ? undefined : 'Dia de 1 a 31.',
      vencimento: diaVencimento ? undefined : 'Dia de 1 a 31.',
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean) || !diaFechamento || !diaVencimento) return
    try {
      await salvarCartao.mutateAsync({
        id: original?.id,
        nome: nome.trim(),
        cor,
        limite_centavos: limite,
        dia_fechamento: diaFechamento,
        dia_vencimento: diaVencimento,
      })
      mostrarAviso(original ? 'Cartão atualizado.' : 'Cartão cadastrado.')
      aoTerminar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  return (
    <Card>
      <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
        <h2 className="font-semibold">{original ? 'Editar cartão' : 'Novo cartão'}</h2>
        {(salvarCartao.error ?? excluir.error) && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {excluir.error
              ? mensagemAoExcluir(
                  excluir.error,
                  'Este cartão tem lançamentos. Arquive em vez de excluir.',
                )
              : mensagemDeErro(salvarCartao.error)}
          </Alerta>
        )}
        <Campo
          rotulo="Nome"
          placeholder="Ex.: Nubank"
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
        />
        <CampoValor
          rotulo="Limite (R$)"
          centavos={limite}
          aoMudar={setLimite}
          erro={erros.limite}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Dia do fechamento"
            inputMode="numeric"
            maxLength={2}
            value={fechamento}
            onChange={(e) => setFechamento(e.target.value.replace(/\D/g, ''))}
            erro={erros.fechamento}
          />
          <Campo
            rotulo="Dia do vencimento"
            inputMode="numeric"
            maxLength={2}
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value.replace(/\D/g, ''))}
            erro={erros.vencimento}
          />
        </div>
        <p className="-mt-2 text-sm text-secundario">
          Compras até o dia do fechamento entram na fatura do mês; depois, na seguinte.
        </p>
        <SeletorCor valor={cor} aoMudar={setCor} />
        <div className="flex flex-col gap-2">
          <Botao type="submit" larguraTotal carregando={salvarCartao.isPending}>
            Salvar cartão
          </Botao>
          <Botao variante="texto" onClick={aoTerminar}>
            Cancelar
          </Botao>
          {original && (
            <ConfirmarAcao
              rotulo="Excluir cartão"
              icone={Trash2}
              pergunta="Excluir este cartão? Só é possível se ele não tiver lançamentos."
              rotuloConfirmar="Excluir"
              carregando={excluir.isPending}
              aoConfirmar={() =>
                quandoTerminar(excluir.mutateAsync(original.id), () => {
                  mostrarAviso('Cartão excluído.')
                  aoTerminar()
                })
              }
            />
          )}
        </div>
      </form>
    </Card>
  )
}

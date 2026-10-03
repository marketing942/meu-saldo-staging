import { CircleAlert, HandCoins, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'

import { CampoConta } from '@/components/formularios/CamposComuns'
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
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { desfazerCom } from '@/lib/dados/desfazer'
import {
  type Receita,
  restaurarReceita,
  useExcluirReceita,
  useReceita,
  useSalvarReceita,
} from '@/lib/dados/receitas'
import { dataValida, hoje } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useVoltar } from '@/lib/navegacao'
import { useUsuario } from '@/lib/sessao'
import { useAvisos } from '@/stores/avisos'

/** /receitas/nova e /receitas/:receitaId (editar). */
export default function FormReceita() {
  const { receitaId } = useParams()
  const contas = useContas()
  const receita = useReceita(receitaId)
  const editando = Boolean(receitaId)
  const consultas = [contas, ...(editando ? [receita] : [])]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{editando ? 'Editar receita' : 'Nova receita'}</h1>
      {consultas.some((c) => c.isPending) ? (
        <Carregando rotulo="Carregando formulário">
          <Esqueleto className="h-72 w-full rounded-card" />
        </Carregando>
      ) : consultas.some((c) => c.isError) ? (
        <EstadoErro
          erro={consultas.find((c) => c.isError)?.error}
          aoTentarDeNovo={() => consultas.forEach((c) => void c.refetch())}
        />
      ) : editando && !receita.data ? (
        <EstadoVazio
          icone={HandCoins}
          titulo="Receita não encontrada"
          descricao="Ela pode ter sido excluída."
          acao={<LinkBotao to="/receitas">Ver receitas</LinkBotao>}
        />
      ) : !contas.data || contas.data.length === 0 ? (
        <Alerta tom="alerta" icone={CircleAlert} titulo="Nenhuma conta encontrada">
          Cadastre uma conta em Configurações › Contas.
        </Alerta>
      ) : (
        <Formulario original={receita.data ?? null} contas={contas.data} />
      )}
    </div>
  )
}

interface Erros {
  descricao?: string
  valor?: string
  data?: string
}

function Formulario({
  original,
  contas,
}: {
  original: Receita | null
  contas: { conta_id: string; nome: string }[]
}) {
  const voltar = useVoltar('/receitas')
  const { id: uid } = useUsuario()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const salvarReceita = useSalvarReceita()
  const excluir = useExcluirReceita()

  const [descricao, setDescricao] = useState(original?.descricao ?? '')
  const [centavos, setCentavos] = useState(original?.valor_centavos ?? 0)
  const [data, setData] = useState(original?.data ?? hoje())
  const [contaEscolhida, setContaEscolhida] = useState(original?.conta_id ?? '')
  const [erros, setErros] = useState<Erros>({})
  const contaId = contaEscolhida || contaPadrao(contas)?.conta_id || ''

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const texto = descricao.trim()
    const novosErros: Erros = {
      descricao: texto ? undefined : 'Diga de onde veio a receita.',
      valor: centavos > 0 ? undefined : 'Digite um valor maior que zero.',
      data: dataValida(data) ? undefined : 'Escolha uma data válida.',
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean) || !contaId) return
    try {
      await salvarReceita.mutateAsync({
        id: original?.id,
        descricao: texto,
        valor_centavos: centavos,
        data,
        conta_id: contaId,
      })
      mostrarAviso(original ? 'Receita atualizada.' : 'Receita salva.')
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
      mostrarAviso('Receita excluída.', {
        rotulo: 'Desfazer',
        executar: desfazerCom(() => restaurarReceita(uid, original.id)),
      })
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  const erroGravacao = salvarReceita.error ?? excluir.error

  return (
    <Card>
      <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
        {erroGravacao && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(erroGravacao)}
          </Alerta>
        )}
        <CampoValor centavos={centavos} aoMudar={setCentavos} erro={erros.valor} />
        <Campo
          rotulo="Descrição"
          placeholder="De onde veio? (ex.: Salário, Freela)"
          maxLength={120}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao}
        />
        <Campo
          rotulo="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          erro={erros.data}
        />
        <CampoConta
          rotulo="Entra na conta"
          contas={contas}
          valor={contaId}
          aoMudar={setContaEscolhida}
        />
        <div className="mt-2 flex flex-col gap-2">
          <Botao type="submit" larguraTotal carregando={salvarReceita.isPending}>
            {original ? 'Salvar alterações' : 'Salvar receita'}
          </Botao>
          <Botao variante="texto" onClick={voltar}>
            Cancelar
          </Botao>
          {original && (
            <ConfirmarAcao
              rotulo="Excluir receita"
              icone={Trash2}
              pergunta="Excluir esta receita?"
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

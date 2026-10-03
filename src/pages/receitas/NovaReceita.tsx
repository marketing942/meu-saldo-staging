import { CircleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { CampoConta } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { contaPadrao, useContas, useCriarReceita } from '@/lib/consultas'
import { dataValida, hoje } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useVoltar } from '@/lib/navegacao'

interface Erros {
  descricao?: string
  valor?: string
  data?: string
}

export default function NovaReceita() {
  const voltar = useVoltar('/receitas')
  const contas = useContas()
  const criar = useCriarReceita()

  const [descricao, setDescricao] = useState('')
  const [centavos, setCentavos] = useState(0)
  const [data, setData] = useState(hoje())
  const [contaEscolhida, setContaEscolhida] = useState('')
  const [erros, setErros] = useState<Erros>({})

  const contaId = contaEscolhida || (contas.data ? contaPadrao(contas.data)?.conta_id : '') || ''

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
      await criar.mutateAsync({
        descricao: texto,
        valor_centavos: centavos,
        data,
        conta_id: contaId,
      })
      voltar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nova receita</h1>

      {contas.isPending ? (
        <Carregando rotulo="Carregando formulário" className="flex flex-col gap-3">
          <Esqueleto className="h-72 w-full rounded-card" />
        </Carregando>
      ) : contas.isError ? (
        <EstadoErro erro={contas.error} aoTentarDeNovo={() => void contas.refetch()} />
      ) : contas.data.length === 0 ? (
        <Alerta tom="alerta" icone={CircleAlert} titulo="Nenhuma conta encontrada">
          Sua conta Carteira não foi encontrada. Saia e entre de novo; se continuar, fale com o
          suporte.
        </Alerta>
      ) : (
        <Card>
          <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
            {criar.isError && (
              <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
                {mensagemDeErro(criar.error)}
              </Alerta>
            )}

            <Campo
              rotulo="Descrição"
              placeholder="Ex.: Salário, Freela, Venda"
              maxLength={120}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              erro={erros.descricao}
            />
            <CampoValor centavos={centavos} aoMudar={setCentavos} erro={erros.valor} />
            <Campo
              rotulo="Data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              erro={erros.data}
            />
            <CampoConta
              rotulo="Entra na conta"
              contas={contas.data}
              valor={contaId}
              aoMudar={setContaEscolhida}
            />

            <div className="mt-2 flex flex-col gap-2">
              <Botao type="submit" larguraTotal carregando={criar.isPending}>
                Salvar receita
              </Botao>
              <Botao variante="texto" onClick={voltar}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}

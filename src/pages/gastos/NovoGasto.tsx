import { CircleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { CampoConta, GrupoEscolha } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { Pilula } from '@/components/ui/Pilula'
import { Selecao } from '@/components/ui/Selecao'
import { contaPadrao, useCategorias, useContas, useCriarGasto } from '@/lib/consultas'
import { dataValida, hoje } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useVoltar } from '@/lib/navegacao'
import type { Enums } from '@/lib/supabase'

import { ROTULO_TIPO } from './rotulos'

/** No MVP, só dinheiro e Pix. Cartão depende do cadastro de cartões (fase 4). */
type OrigemMvp = Exclude<Enums['origem_gasto'], 'cartao'>
type Tipo = Enums['tipo_gasto']

interface Erros {
  descricao?: string
  valor?: string
  data?: string
  tipo?: string
}

export default function NovoGasto() {
  const voltar = useVoltar('/gastos')
  const contas = useContas()
  const categorias = useCategorias()
  const criar = useCriarGasto()

  const [descricao, setDescricao] = useState('')
  const [centavos, setCentavos] = useState(0)
  const [data, setData] = useState(hoje())
  const [origem, setOrigem] = useState<OrigemMvp>('pix')
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [contaEscolhida, setContaEscolhida] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [erros, setErros] = useState<Erros>({})

  const contaId = contaEscolhida || (contas.data ? contaPadrao(contas.data)?.conta_id : '') || ''

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const texto = descricao.trim()
    const novosErros: Erros = {
      descricao: texto ? undefined : 'Descreva o gasto.',
      valor: centavos > 0 ? undefined : 'Digite um valor maior que zero.',
      data: dataValida(data) ? undefined : 'Escolha uma data válida.',
      tipo: tipo ? undefined : 'Escolha se foi necessário ou desnecessário.',
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean) || !tipo || !contaId) return

    try {
      await criar.mutateAsync({
        descricao: texto,
        valor_centavos: centavos,
        data,
        origem,
        tipo,
        conta_id: contaId,
        categoria_id: categoriaId || null,
      })
      voltar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Novo gasto</h1>

      {contas.isPending ? (
        <Carregando rotulo="Carregando formulário" className="flex flex-col gap-3">
          <Esqueleto className="h-96 w-full rounded-card" />
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
              placeholder="Ex.: Mercado, Uber, Farmácia"
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

            <GrupoEscolha legenda="Como pagou?">
              <Pilula ativa={origem === 'pix'} onClick={() => setOrigem('pix')}>
                Pix
              </Pilula>
              <Pilula ativa={origem === 'dinheiro'} onClick={() => setOrigem('dinheiro')}>
                Dinheiro
              </Pilula>
              <Pilula disabled className="opacity-50" title="Em breve">
                Cartão (em breve)
              </Pilula>
            </GrupoEscolha>

            <CampoConta
              rotulo="Sai da conta"
              contas={contas.data}
              valor={contaId}
              aoMudar={setContaEscolhida}
            />

            <GrupoEscolha legenda="Esse gasto foi..." erro={erros.tipo}>
              {(['necessario', 'desnecessario'] as const).map((opcao) => (
                <Pilula key={opcao} ativa={tipo === opcao} onClick={() => setTipo(opcao)}>
                  {ROTULO_TIPO[opcao]}
                </Pilula>
              ))}
            </GrupoEscolha>

            <Selecao
              rotulo="Categoria (opcional)"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={!categorias.data}
            >
              <option value="">Sem categoria</option>
              {categorias.data?.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </Selecao>

            <div className="mt-2 flex flex-col gap-2">
              <Botao type="submit" larguraTotal carregando={criar.isPending}>
                Salvar gasto
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

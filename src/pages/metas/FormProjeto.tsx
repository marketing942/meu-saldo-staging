import { CircleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { CampoConta } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Interruptor } from '@/components/ui/Interruptor'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { type Projeto, useSalvarProjeto } from '@/lib/dados/projetos'
import { mensagemDeErro } from '@/lib/erros'
import { useAvisos } from '@/stores/avisos'

/** Criar ou editar um projeto (evento, viagem, reforma...). */
export function FormProjeto({
  original,
  aoTerminar,
}: {
  original?: Projeto
  aoTerminar: (id?: string) => void
}) {
  const contas = useContas()
  const salvarProjeto = useSalvarProjeto()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [nome, setNome] = useState(original?.nome ?? '')
  const [orcamento, setOrcamento] = useState(original?.orcamento_centavos ?? 0)
  const [descontar, setDescontar] = useState(original?.descontar_do_saldo ?? false)
  const [contaEscolhida, setContaEscolhida] = useState(original?.conta_id ?? '')
  const [erro, setErro] = useState<string | undefined>()
  const contaId = contaEscolhida || (contas.data ? contaPadrao(contas.data)?.conta_id : '') || ''

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome ao projeto.')
      return
    }
    setErro(undefined)
    try {
      const id = await salvarProjeto.mutateAsync({
        id: original?.id,
        nome: nome.trim(),
        orcamento_centavos: orcamento > 0 ? orcamento : null,
        descontar_do_saldo: descontar,
        conta_id: descontar ? contaId || null : null,
      })
      mostrarAviso(original ? 'Projeto atualizado.' : 'Projeto criado.')
      aoTerminar(id)
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  return (
    <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
      {salvarProjeto.isError && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(salvarProjeto.error)}
        </Alerta>
      )}
      <Campo
        rotulo="Nome do projeto"
        placeholder="Ex.: Aniversário do João, Viagem"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erro}
      />
      <CampoValor rotulo="Orçamento (opcional, R$)" centavos={orcamento} aoMudar={setOrcamento} />
      <Interruptor
        rotulo="Descontar do saldo"
        descricao="Os gastos do projeto saem do saldo da carteira. Mesmo assim, ficam fora dos totais do mês."
        ligado={descontar}
        aoMudar={setDescontar}
      />
      {descontar && contas.data && contas.data.length > 0 && (
        <CampoConta
          rotulo="Sai da carteira"
          contas={contas.data}
          valor={contaId}
          aoMudar={setContaEscolhida}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvarProjeto.isPending}>
          {original ? 'Salvar projeto' : 'Criar projeto'}
        </Botao>
        <Botao variante="secundario" onClick={() => aoTerminar()}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}

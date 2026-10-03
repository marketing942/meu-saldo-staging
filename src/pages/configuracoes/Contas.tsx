import { CircleAlert, Plus, Trash2, Wallet } from 'lucide-react'
import { type FormEvent, useState } from 'react'

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
import { useContas, useExcluirConta, useSalvarConta } from '@/lib/dados/contas'
import { mensagemAoExcluir, mensagemDeErro } from '@/lib/erros'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

import { CabecalhoConfig } from './comum'

interface Conta {
  conta_id: string
  nome: string
  saldo_inicial_centavos: number
  saldo_centavos: number
}

/** Carteiras (no banco: tabela contas). */
export default function Contas() {
  const contas = useContas()
  const formatar = useFormatarValor()
  const [editando, setEditando] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoConfig
        titulo="Carteiras"
        descricao="O saldo total é a soma das carteiras."
        acao={
          editando !== 'nova' && (
            <Botao icone={Plus} onClick={() => setEditando('nova')}>
              Nova carteira
            </Botao>
          )
        }
      />
      {editando === 'nova' && (
        <Card>
          <FormConta aoTerminar={() => setEditando(null)} />
        </Card>
      )}
      {contas.isPending ? (
        <Carregando rotulo="Carregando carteiras">
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : contas.isError ? (
        <EstadoErro erro={contas.error} aoTentarDeNovo={() => void contas.refetch()} />
      ) : contas.data.length === 0 ? (
        <EstadoVazio
          icone={Wallet}
          titulo="Nenhuma carteira"
          descricao="Cadastre onde seu dinheiro fica: dinheiro vivo, banco, poupança."
          acao={<Botao onClick={() => setEditando('nova')}>Cadastrar carteira</Botao>}
        />
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-borda">
            {contas.data.map((conta) => (
              <li key={conta.conta_id} className="py-3">
                {editando === conta.conta_id ? (
                  <FormConta
                    original={conta}
                    podeExcluir={contas.data.length > 1}
                    aoTerminar={() => setEditando(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{conta.nome}</p>
                      <p className="text-sm text-secundario">
                        Saldo atual{' '}
                        <span className="valor font-medium text-texto">
                          {formatar(conta.saldo_centavos)}
                        </span>
                      </p>
                    </div>
                    <Botao
                      variante="texto"
                      className="text-sm"
                      onClick={() => setEditando(conta.conta_id)}
                    >
                      Editar
                    </Botao>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function FormConta({
  original,
  podeExcluir = false,
  aoTerminar,
}: {
  original?: Conta
  podeExcluir?: boolean
  aoTerminar: () => void
}) {
  const salvarConta = useSalvarConta()
  const excluir = useExcluirConta()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [nome, setNome] = useState(original?.nome ?? '')
  const [saldoInicial, setSaldoInicial] = useState(Math.abs(original?.saldo_inicial_centavos ?? 0))
  const [negativo, setNegativo] = useState((original?.saldo_inicial_centavos ?? 0) < 0)
  const [erro, setErro] = useState<string | undefined>()

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome à carteira.')
      return
    }
    setErro(undefined)
    try {
      await salvarConta.mutateAsync({
        id: original?.conta_id,
        nome: nome.trim(),
        saldo_inicial_centavos: negativo ? -saldoInicial : saldoInicial,
      })
      mostrarAviso(original ? 'Carteira atualizada.' : 'Carteira criada.')
      aoTerminar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  return (
    <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
      <h2 className="font-semibold">{original ? 'Editar carteira' : 'Nova carteira'}</h2>
      {(salvarConta.error ?? excluir.error) && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {excluir.error
            ? mensagemAoExcluir(
                excluir.error,
                'Esta carteira tem lançamentos e não pode ser excluída.',
              )
            : mensagemDeErro(salvarConta.error)}
        </Alerta>
      )}
      <Campo
        rotulo="Nome"
        placeholder="Ex.: Banco, Poupança"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erro}
      />
      <div className="flex flex-col gap-1.5">
        <CampoValor rotulo="Saldo inicial (R$)" centavos={saldoInicial} aoMudar={setSaldoInicial} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={negativo}
            onChange={(e) => setNegativo(e.target.checked)}
            className="size-5 accent-[var(--destaque)]"
          />
          Saldo inicial negativo
        </label>
        <p className="text-sm text-secundario">
          Quanto havia na carteira antes dos lançamentos no app. O saldo atual é calculado a partir
          dele.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvarConta.isPending}>
          Salvar
        </Botao>
        <Botao variante="secundario" onClick={aoTerminar}>
          Cancelar
        </Botao>
      </div>
      {original && podeExcluir && (
        <ConfirmarAcao
          rotulo="Excluir carteira"
          icone={Trash2}
          pergunta="Excluir esta carteira? Só é possível se ela não tiver lançamentos."
          rotuloConfirmar="Excluir"
          carregando={excluir.isPending}
          aoConfirmar={() =>
            quandoTerminar(excluir.mutateAsync(original.conta_id), () => {
              mostrarAviso('Carteira excluída.')
              aoTerminar()
            })
          }
        />
      )}
    </form>
  )
}

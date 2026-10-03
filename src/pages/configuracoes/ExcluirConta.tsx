import { CircleAlert, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { excluirMinhaConta } from '@/lib/dados/conta'

import { CabecalhoConfig } from './comum'

const PALAVRA = 'EXCLUIR'

export default function ExcluirConta() {
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function excluir(evento: FormEvent) {
    evento.preventDefault()
    if (confirmacao.trim().toUpperCase() !== PALAVRA) return
    setEnviando(true)
    setErro(null)
    try {
      // Com sucesso, a sessão acaba e o app volta sozinho para /entrar.
      await excluirMinhaConta()
    } catch {
      setErro('Não foi possível excluir a conta agora. Tente de novo em alguns minutos.')
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoConfig titulo="Excluir minha conta" />
      <Card>
        <form noValidate onSubmit={(e) => void excluir(e)} className="flex flex-col gap-4">
          <Alerta tom="desnecessario" icone={CircleAlert} titulo="Esta ação não tem volta">
            Todos os seus dados serão apagados de forma definitiva: carteiras, gastos, receitas,
            cartões, faturas, contas a pagar, previsão de desnecessários e projetos.
          </Alerta>
          {erro && (
            <Alerta tom="alerta" icone={CircleAlert} anunciar>
              {erro}
            </Alerta>
          )}
          <Campo
            rotulo={`Para confirmar, digite ${PALAVRA}`}
            autoComplete="off"
            autoCapitalize="characters"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
          <Botao
            type="submit"
            variante="perigo"
            icone={Trash2}
            larguraTotal
            carregando={enviando}
            disabled={confirmacao.trim().toUpperCase() !== PALAVRA}
          >
            Excluir minha conta para sempre
          </Botao>
        </form>
      </Card>
    </div>
  )
}

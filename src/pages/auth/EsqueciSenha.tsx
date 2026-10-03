import { CircleAlert, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { mensagemDeErroAuth } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { CabecalhoAuth } from './comum'
import { emailValido } from './validacao'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErroGeral(null)
    if (!emailValido(email)) {
      setErro('Digite um e-mail válido.')
      return
    }
    setErro(undefined)
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Precisa estar nas Redirect URLs do Supabase.
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    setEnviando(false)
    if (error) setErroGeral(mensagemDeErroAuth(error))
    else setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoAuth titulo="Confira seu e-mail" subtitulo="Enviamos as instruções." />
        <EstadoVazio
          icone={MailCheck}
          titulo="Link de recuperação enviado"
          descricao="Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha. Abra o link neste mesmo aparelho e navegador."
          acao={<LinkBotao to="/entrar">Voltar para Entrar</LinkBotao>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoAuth
        titulo="Esqueci minha senha"
        subtitulo="Informe seu e-mail para receber um link de recuperação."
      />
      <Card>
        <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
          {erroGeral && (
            <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
              {erroGeral}
            </Alerta>
          )}
          <Campo
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erro={erro}
          />
          <Botao type="submit" larguraTotal carregando={enviando}>
            Enviar link de recuperação
          </Botao>
        </form>
      </Card>
      <p className="text-center text-sm">
        <Link to="/entrar" className="font-medium text-destaque underline-offset-4 hover:underline">
          Voltar para Entrar
        </Link>
      </p>
    </div>
  )
}

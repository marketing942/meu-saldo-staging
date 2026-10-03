import { CircleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { mensagemDeErroAuth } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { BotaoMostrarSenha, CabecalhoAuth } from './comum'
import { emailValido } from './validacao'

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros = {
      email: emailValido(email) ? undefined : 'Digite um e-mail válido.',
      senha: senha ? undefined : 'Digite sua senha.',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.email || novosErros.senha) return

    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setEnviando(false)
    // Com sucesso, a sessão muda e <SomenteVisitante> leva para o app.
    if (error) setErroGeral(mensagemDeErroAuth(error))
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoAuth
        titulo="Entrar"
        subtitulo="Acesse sua conta para ver seu saldo e seus gastos."
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
            erro={erros.email}
          />
          <Campo
            rotulo="Senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
            acessorio={
              <BotaoMostrarSenha
                visivel={mostrarSenha}
                aoAlternar={() => setMostrarSenha((v) => !v)}
              />
            }
          />
          <Botao type="submit" larguraTotal carregando={enviando}>
            Entrar
          </Botao>
        </form>
      </Card>

      <p className="text-center text-sm text-secundario">
        Ainda não tem conta?{' '}
        <Link
          to="/cadastro"
          className="font-medium text-destaque underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  )
}

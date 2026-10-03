import { CircleAlert, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { mensagemDeErroAuth } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { BotaoMostrarSenha, CabecalhoAuth } from './comum'
import { SENHA_MINIMO, emailValido } from './validacao'

interface Erros {
  email?: string
  senha?: string
  confirmacao?: string
}

export default function Cadastro() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarEmail, setConfirmarEmail] = useState<string | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros: Erros = {
      email: emailValido(email) ? undefined : 'Digite um e-mail válido.',
      senha:
        senha.length >= SENHA_MINIMO
          ? undefined
          : `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`,
      confirmacao: confirmacao === senha ? undefined : 'As senhas não são iguais.',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.email || novosErros.senha || novosErros.confirmacao) return

    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      // Link de confirmação volta para este endereço (precisa estar nas Redirect URLs).
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    setEnviando(false)
    if (error) {
      setErroGeral(mensagemDeErroAuth(error))
      return
    }
    // Com confirmação de e-mail ligada, não há sessão até o usuário clicar no link.
    // Sem ela, a sessão já existe e <SomenteVisitante> leva para o app.
    if (!data.session) setConfirmarEmail(email.trim())
  }

  if (confirmarEmail) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoAuth titulo="Confira seu e-mail" subtitulo="Falta só um passo." />
        <EstadoVazio
          icone={MailCheck}
          titulo="Enviamos um link de confirmação"
          descricao={
            <>
              Abra o e-mail enviado para <strong>{confirmarEmail}</strong> e toque no link para
              ativar sua conta. Se você já tinha cadastro, é só entrar.
            </>
          }
          acao={
            <Link
              to="/entrar"
              className="inline-flex min-h-11 items-center rounded-botao bg-destaque px-5 font-semibold text-sobre-destaque"
            >
              Ir para Entrar
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoAuth
        titulo="Criar conta"
        subtitulo="Cadastre-se para organizar seus gastos e receitas do mês."
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
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
            ajuda={erros.senha ? undefined : `Pelo menos ${SENHA_MINIMO} caracteres.`}
            acessorio={
              <BotaoMostrarSenha
                visivel={mostrarSenha}
                aoAlternar={() => setMostrarSenha((v) => !v)}
              />
            }
          />
          <Campo
            rotulo="Confirme a senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            erro={erros.confirmacao}
          />
          <Botao type="submit" larguraTotal carregando={enviando}>
            Criar conta
          </Botao>
        </form>
      </Card>

      <p className="text-center text-sm text-secundario">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-destaque underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}

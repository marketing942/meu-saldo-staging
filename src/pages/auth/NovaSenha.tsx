import { CircleAlert, KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { CarregandoTela } from '@/app/layouts/CarregandoTela'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { mensagemDeErroAuth } from '@/lib/erros'
import { useSessao } from '@/lib/sessao'
import { supabase } from '@/lib/supabase'
import { useAvisos } from '@/stores/avisos'

import { BotaoMostrarSenha, CabecalhoAuth } from './comum'
import { SENHA_MINIMO } from './validacao'

/**
 * Destino do link "Esqueci minha senha". O Supabase troca o código do link por
 * uma sessão (detectSessionInUrl); com ela, o usuário define a nova senha.
 */
export default function NovaSenha() {
  const { sessao, carregando } = useSessao()
  const navegar = useNavigate()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<{ senha?: string; confirmacao?: string }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando) return <CarregandoTela />

  if (!sessao) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoAuth titulo="Nova senha" subtitulo="Não foi possível validar o link." />
        <EstadoVazio
          icone={KeyRound}
          titulo="Link inválido ou expirado"
          descricao="Peça um novo link e abra-o neste mesmo aparelho e navegador em que você fez o pedido."
          acao={<LinkBotao to="/esqueci-senha">Pedir novo link</LinkBotao>}
        />
      </div>
    )
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros = {
      senha:
        senha.length >= SENHA_MINIMO
          ? undefined
          : `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`,
      confirmacao: confirmacao === senha ? undefined : 'As senhas não são iguais.',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.senha || novosErros.confirmacao) return
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) {
      setErroGeral(mensagemDeErroAuth(error))
      return
    }
    mostrarAviso('Senha alterada.')
    void navegar('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoAuth titulo="Nova senha" subtitulo="Escolha a nova senha da sua conta." />
      <Card>
        <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
          {erroGeral && (
            <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
              {erroGeral}
            </Alerta>
          )}
          <Campo
            rotulo="Nova senha"
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
            rotulo="Confirme a nova senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            erro={erros.confirmacao}
          />
          <Botao type="submit" larguraTotal carregando={enviando}>
            Salvar nova senha
          </Botao>
        </form>
      </Card>
    </div>
  )
}

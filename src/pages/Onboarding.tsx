import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { CarregandoTela } from '@/app/layouts/CarregandoTela'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card } from '@/components/ui/Card'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { dados } from '@/lib/dados/comum'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { usePerfil } from '@/lib/dados/perfil'
import { mensagemDeErro } from '@/lib/erros'
import { useUsuario } from '@/lib/sessao'
import { supabase } from '@/lib/supabase'

/**
 * Primeiro acesso em 2 passos: nome e saldo inicial; depois a previsão mensal de
 * desnecessários. Tudo pode ser pulado.
 */
export default function Onboarding() {
  const { id: uid } = useUsuario()
  const perfil = usePerfil()
  const contas = useContas()
  const cliente = useQueryClient()
  const navegar = useNavigate()

  const [passo, setPasso] = useState<1 | 2>(1)
  const [nome, setNome] = useState<string | null>(null)
  const [saldo, setSaldo] = useState(0)
  const [previsaoDesnecessarios, setPrevisaoDesnecessarios] = useState(0)
  const [erroNome, setErroNome] = useState<string | undefined>()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  if (perfil.isPending || contas.isPending) return <CarregandoTela />
  if (perfil.isError || contas.isError) {
    return (
      <EstadoErro
        erro={perfil.error ?? contas.error}
        aoTentarDeNovo={() => {
          void perfil.refetch()
          void contas.refetch()
        }}
      />
    )
  }
  if (perfil.data?.onboarding_concluido) return <Navigate to="/" replace />

  const nomeAtual = nome ?? perfil.data?.nome ?? ''
  const carteira = contaPadrao(contas.data)

  async function concluir(pular: boolean) {
    setSalvando(true)
    setErroGeral(null)
    try {
      // upsert: se o perfil não existir (usuário antigo), ele é criado aqui.
      await dados(
        supabase.from('profiles').upsert({
          id: uid,
          onboarding_concluido: true,
          ...(pular
            ? {}
            : {
                nome: nomeAtual.trim(),
                meta_desnecessario_centavos:
                  previsaoDesnecessarios > 0 ? previsaoDesnecessarios : null,
              }),
        }),
      )
      if (!pular && carteira && saldo !== 0) {
        await dados(
          supabase
            .from('contas')
            .update({ saldo_inicial_centavos: saldo })
            .eq('id', carteira.conta_id)
            .eq('user_id', uid),
        )
      }
      await cliente.invalidateQueries()
      void navegar('/', { replace: true })
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro))
      setSalvando(false)
    }
  }

  function avancar(evento: FormEvent) {
    evento.preventDefault()
    if (passo === 1) {
      if (!nomeAtual.trim()) {
        setErroNome('Diga como quer ser chamado(a).')
        return
      }
      setErroNome(undefined)
      setPasso(2)
      return
    }
    void concluir(false)
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="grid grid-cols-2 gap-1.5" aria-hidden>
        <span className="h-1.5 rounded-full bg-destaque" />
        <span className={`h-1.5 rounded-full ${passo === 2 ? 'bg-destaque' : 'bg-borda'}`} />
      </div>
      <header>
        <p className="text-sm text-secundario">Passo {passo} de 2</p>
        <h1 className="text-2xl font-semibold">
          {passo === 1 ? 'Vamos começar' : 'Previsão de desnecessários'}
        </h1>
      </header>

      <Card>
        <form noValidate onSubmit={avancar} className="flex flex-col gap-4">
          {erroGeral && (
            <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
              {erroGeral}
            </Alerta>
          )}
          {passo === 1 ? (
            <>
              <Campo
                rotulo="Seu nome"
                autoComplete="name"
                maxLength={80}
                value={nomeAtual}
                onChange={(e) => setNome(e.target.value)}
                erro={erroNome}
              />
              <div className="flex flex-col gap-1.5">
                <CampoValor
                  rotulo={`Saldo inicial da ${carteira?.nome ?? 'Carteira'} (R$)`}
                  centavos={saldo}
                  aoMudar={setSaldo}
                />
                <p className="text-sm text-secundario">
                  Quanto você tem hoje. Pode ser aproximado; você ajusta depois em Configurações.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <CampoValor
                rotulo="Previsão mensal de desnecessários (R$)"
                centavos={previsaoDesnecessarios}
                aoMudar={setPrevisaoDesnecessarios}
              />
              <p className="text-sm text-secundario">
                Quanto você prevê gastar por mês com o que não é necessário. Você recebe avisos aos
                70%, 90% e 100% desse valor e pode mudar depois em Metas. Deixe zerado para não
                usar.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            {passo === 2 && (
              <Botao variante="secundario" onClick={() => setPasso(1)} disabled={salvando}>
                Voltar
              </Botao>
            )}
            <Botao type="submit" larguraTotal carregando={salvando} className="flex-1">
              {passo === 1 ? 'Continuar' : 'Concluir'}
            </Botao>
          </div>
        </form>
      </Card>
      <Botao variante="texto" onClick={() => void concluir(true)} disabled={salvando}>
        Pular por agora
      </Botao>
    </div>
  )
}

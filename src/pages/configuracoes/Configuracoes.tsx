import {
  ChevronRight,
  CircleAlert,
  CreditCard,
  Database,
  FileText,
  LogOut,
  ShieldCheck,
  Tags,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card, TituloCard } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Icone } from '@/components/ui/Icone'
import { Interruptor } from '@/components/ui/Interruptor'
import { Pilula } from '@/components/ui/Pilula'
import { MARCA } from '@/config/marca'
import { useAtualizarTudo, quandoTerminar } from '@/lib/dados/comum'
import { contaPadrao, useContas } from '@/lib/dados/contas'
import { carregarDadosDeExemplo, limparDadosDeExemplo } from '@/lib/dados/exemplo'
import { type Perfil, useAtualizarPerfil, usePerfil } from '@/lib/dados/perfil'
import { env, permiteDadosDeExemplo } from '@/lib/env'
import { mensagemDeErro } from '@/lib/erros'
import { sair, useUsuario } from '@/lib/sessao'
import type { Tema } from '@/lib/tema'
import { useAvisos } from '@/stores/avisos'
import { useUI } from '@/stores/ui'

export default function Configuracoes() {
  const perfil = usePerfil()
  const usuario = useUsuario()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card className="flex flex-col gap-3">
        <TituloCard>Perfil</TituloCard>
        {perfil.data && <FormNome key={perfil.data.nome} perfil={perfil.data} />}
        <p className="text-sm text-secundario">
          E-mail: <span className="text-texto">{usuario.email}</span>
        </p>
      </Card>

      <Preferencias perfil={perfil.data ?? null} />

      <Card className="py-1">
        <ul className="divide-y divide-borda">
          <ItemLink para="/configuracoes/contas" icone={Wallet} rotulo="Contas" />
          <ItemLink para="/configuracoes/cartoes" icone={CreditCard} rotulo="Cartões" />
          <ItemLink para="/configuracoes/categorias" icone={Tags} rotulo="Categorias" />
          <ItemLink
            para="/metas?aba=desnecessarios"
            icone={Target}
            rotulo="Meta de desnecessários"
          />
        </ul>
      </Card>

      {permiteDadosDeExemplo && <DadosDeExemplo />}

      <Card className="py-1">
        <ul className="divide-y divide-borda">
          <ItemLink para="/termos" icone={FileText} rotulo="Termos de uso" />
          <ItemLink para="/privacidade" icone={ShieldCheck} rotulo="Política de privacidade" />
        </ul>
      </Card>

      <div className="flex flex-col gap-2">
        <Botao variante="secundario" icone={LogOut} larguraTotal onClick={() => void sair()}>
          Sair
        </Botao>
        <Link
          to="/configuracoes/excluir-conta"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-botao text-[15px] font-medium text-desnecessario underline-offset-4 hover:underline"
        >
          <Icone icone={Trash2} tamanho={18} /> Excluir minha conta
        </Link>
      </div>

      <p className="text-center text-xs text-secundario">
        {MARCA.nome} · ambiente {env.VITE_APP_AMBIENTE}
      </p>
    </div>
  )
}

function ItemLink({
  para,
  icone,
  rotulo,
}: {
  para: string
  icone: typeof Wallet
  rotulo: ReactNode
}) {
  return (
    <li>
      <Link
        to={para}
        className="-mx-2 flex min-h-12 items-center gap-3 rounded-campo px-2 hover:bg-fundo"
      >
        <Icone icone={icone} tamanho={20} className="text-secundario" />
        <span className="flex-1 font-medium">{rotulo}</span>
        <Icone icone={ChevronRight} tamanho={18} className="text-secundario" />
      </Link>
    </li>
  )
}

function FormNome({ perfil }: { perfil: Perfil }) {
  const atualizar = useAtualizarPerfil()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [nome, setNome] = useState(perfil.nome)

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (nome.trim() === perfil.nome) return
    quandoTerminar(atualizar.mutateAsync({ nome: nome.trim() }), () =>
      mostrarAviso('Nome atualizado.'),
    )
  }

  return (
    <form onSubmit={salvar} className="flex items-end gap-2">
      <Campo
        rotulo="Nome"
        autoComplete="name"
        maxLength={80}
        className="flex-1"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao
        type="submit"
        variante="secundario"
        carregando={atualizar.isPending}
        disabled={nome.trim() === perfil.nome}
      >
        Salvar
      </Botao>
    </form>
  )
}

const TEMAS: { valor: Tema; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
]

function Preferencias({ perfil }: { perfil: Perfil | null }) {
  const atualizar = useAtualizarPerfil()
  const { tema, ocultarValores, definirTema, definirOcultarValores } = useUI()

  return (
    <Card className="flex flex-col gap-4">
      <TituloCard>Preferências</TituloCard>
      {atualizar.isError && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(atualizar.error)}
        </Alerta>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">Tema</legend>
        <div className="flex flex-wrap gap-2">
          {TEMAS.map((t) => (
            <Pilula
              key={t.valor}
              ativa={tema === t.valor}
              onClick={() => {
                definirTema(t.valor)
                atualizar.mutate({ tema: t.valor })
              }}
            >
              {t.rotulo}
            </Pilula>
          ))}
        </div>
      </fieldset>
      <Interruptor
        rotulo="Ocultar valores"
        descricao="Troca os valores por R$ •••• (bom para usar em público)."
        ligado={ocultarValores}
        aoMudar={(ligado) => {
          definirOcultarValores(ligado)
          atualizar.mutate({ ocultar_valores: ligado })
        }}
      />
      <Interruptor
        rotulo="Lembrete diário"
        descricao="Mostra no Início um lembrete quando você ainda não lançou nada no dia."
        ligado={perfil?.lembrete_diario ?? true}
        desabilitado={!perfil}
        aoMudar={(ligado) => atualizar.mutate({ lembrete_diario: ligado })}
      />
    </Card>
  )
}

function DadosDeExemplo() {
  const { id: uid } = useUsuario()
  const contas = useContas()
  const atualizarTudo = useAtualizarTudo()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [ocupado, setOcupado] = useState<'carregar' | 'limpar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function executar(acao: 'carregar' | 'limpar') {
    setOcupado(acao)
    setErro(null)
    try {
      if (acao === 'carregar') {
        const conta = contas.data ? contaPadrao(contas.data) : undefined
        if (!conta) throw new Error('Sem conta para os exemplos.')
        await carregarDadosDeExemplo(uid, conta.conta_id)
      } else {
        await limparDadosDeExemplo(uid)
      }
      await atualizarTudo()
      mostrarAviso(
        acao === 'carregar' ? 'Dados de exemplo carregados.' : 'Dados de exemplo apagados.',
      )
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <TituloCard className="flex items-center gap-2">
        <Icone icone={Database} tamanho={18} /> Dados de exemplo
      </TituloCard>
      <p className="text-sm text-secundario">
        Só aparece fora de produção. Cria um cartão, gastos, receitas, dívidas e um projeto com
        &quot;(exemplo)&quot; no nome, para testar o app.
      </p>
      {erro && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {erro}
        </Alerta>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          carregando={ocupado === 'carregar'}
          disabled={ocupado !== null || !contas.data}
          onClick={() => void executar('carregar')}
        >
          Carregar dados de exemplo
        </Botao>
        <ConfirmarAcao
          rotulo="Limpar dados de exemplo"
          pergunta='Apagar de vez tudo que tem "(exemplo)" no nome?'
          rotuloConfirmar="Apagar"
          carregando={ocupado === 'limpar'}
          aoConfirmar={() => void executar('limpar')}
        />
      </div>
    </Card>
  )
}

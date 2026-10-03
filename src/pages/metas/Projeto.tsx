import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CircleAlert,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card, TituloCard } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { Icone } from '@/components/ui/Icone'
import { LinkBotao } from '@/components/ui/LinkBotao'
import { quandoTerminar } from '@/lib/dados/comum'
import { desfazerCom } from '@/lib/dados/desfazer'
import {
  restaurarGastoProjeto,
  restaurarProjeto,
  useAlterarProjeto,
  useExcluirGastoProjeto,
  useProjeto,
  useSalvarGastoProjeto,
} from '@/lib/dados/projetos'
import { dataValida, formatarData, hoje } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { progressoProjeto } from '@/lib/regras/resumo'
import { useUsuario } from '@/lib/sessao'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

import { FormProjeto } from './FormProjeto'

export default function Projeto() {
  const { projetoId } = useParams()
  const { id: uid } = useUsuario()
  const projeto = useProjeto(projetoId)
  const alterar = useAlterarProjeto()
  const excluirGasto = useExcluirGastoProjeto()
  const formatar = useFormatarValor()
  const navegar = useNavigate()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [editando, setEditando] = useState(false)

  const voltar = (
    <LinkBotao to="/metas" variante="texto" icone={ArrowLeft} className="self-start">
      Projetos
    </LinkBotao>
  )

  if (projeto.isPending) {
    return (
      <Carregando rotulo="Carregando projeto" className="flex flex-col gap-4">
        <Esqueleto className="h-40 w-full rounded-card" />
        <Esqueleto className="h-40 w-full rounded-card" />
      </Carregando>
    )
  }
  if (projeto.isError) {
    return <EstadoErro erro={projeto.error} aoTentarDeNovo={() => void projeto.refetch()} />
  }
  if (!projeto.data) {
    return (
      <EstadoVazio
        icone={FolderKanban}
        titulo="Projeto não encontrado"
        descricao="Ele pode ter sido excluído."
        acao={<LinkBotao to="/metas">Ver projetos</LinkBotao>}
      />
    )
  }

  const { projeto: p, gastos, total_centavos: total } = projeto.data
  const prog = progressoProjeto(total, p.orcamento_centavos)

  return (
    <div className="flex flex-col gap-4">
      {voltar}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.nome}</h1>
          <p className="text-sm text-secundario">
            {p.arquivado ? 'Arquivado · ' : ''}
            {p.descontar_do_saldo ? 'Desconta do saldo' : 'Não desconta do saldo'}
          </p>
        </div>
        {!editando && (
          <Botao
            variante="texto"
            icone={Pencil}
            className="text-sm"
            onClick={() => setEditando(true)}
          >
            Editar
          </Botao>
        )}
      </div>

      {editando ? (
        <Card className="flex flex-col gap-4">
          <FormProjeto original={p} aoTerminar={() => setEditando(false)} />
          <div className="flex flex-col gap-2 border-t border-borda pt-4">
            <Botao
              variante="secundario"
              icone={p.arquivado ? ArchiveRestore : Archive}
              carregando={alterar.isPending}
              onClick={() =>
                quandoTerminar(alterar.mutateAsync({ id: p.id, arquivado: !p.arquivado }), () => {
                  mostrarAviso(p.arquivado ? 'Projeto reativado.' : 'Projeto arquivado.')
                  setEditando(false)
                })
              }
            >
              {p.arquivado ? 'Reativar projeto' : 'Arquivar projeto'}
            </Botao>
            <ConfirmarAcao
              rotulo="Excluir projeto"
              icone={Trash2}
              pergunta="Excluir este projeto e seus gastos?"
              rotuloConfirmar="Excluir"
              carregando={alterar.isPending}
              aoConfirmar={() =>
                quandoTerminar(alterar.mutateAsync({ id: p.id, excluir: true }), () => {
                  void navegar('/metas', { replace: true })
                  mostrarAviso('Projeto excluído.', {
                    rotulo: 'Desfazer',
                    executar: desfazerCom(() => restaurarProjeto(uid, p.id)),
                  })
                })
              }
            />
            {alterar.isError && (
              <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
                {mensagemDeErro(alterar.error)}
              </Alerta>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <TituloCard>Total gasto</TituloCard>
          <p className="valor text-3xl font-semibold">{formatar(total)}</p>
          {prog.percentual !== null && p.orcamento_centavos !== null && (
            <>
              <BarraProgresso
                rotulo="Uso do orçamento"
                percentual={prog.percentual}
                cor={
                  prog.excedenteCentavos
                    ? 'bg-desnecessario'
                    : prog.alerta
                      ? 'bg-alerta'
                      : 'bg-destaque'
                }
              />
              <p className="text-sm text-secundario">
                {Math.round(prog.percentual)}% do orçamento de {formatar(p.orcamento_centavos)}
                {prog.excedenteCentavos
                  ? ` · passou ${formatar(prog.excedenteCentavos)}`
                  : ` · restam ${formatar(prog.restanteCentavos ?? 0)}`}
              </p>
              {prog.alerta && !prog.excedenteCentavos && (
                <Alerta tom="alerta" icone={CircleAlert}>
                  O projeto já usou mais de 90% do orçamento.
                </Alerta>
              )}
            </>
          )}
        </Card>
      )}

      <NovoGastoProjeto projetoId={p.id} />

      <section aria-labelledby="titulo-gastos-projeto" className="flex flex-col gap-2">
        <h2 id="titulo-gastos-projeto" className="text-sm font-medium text-secundario">
          Gastos do projeto
        </h2>
        {gastos.length === 0 ? (
          <Card className="text-sm text-secundario">Nenhum gasto neste projeto ainda.</Card>
        ) : (
          <Card className="py-1">
            <ul className="divide-y divide-borda">
              {gastos.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.descricao}</p>
                    <p className="text-sm text-secundario">{formatarData(g.data)}</p>
                  </div>
                  <span className="valor shrink-0 font-semibold">{formatar(g.valor_centavos)}</span>
                  <button
                    type="button"
                    aria-label={`Excluir ${g.descricao}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-secundario hover:text-desnecessario"
                    onClick={() =>
                      quandoTerminar(
                        excluirGasto.mutateAsync(g.id),
                        () =>
                          mostrarAviso('Gasto do projeto excluído.', {
                            rotulo: 'Desfazer',
                            executar: desfazerCom(() => restaurarGastoProjeto(uid, g.id)),
                          }),
                        () => mostrarAviso('Não foi possível excluir. Tente de novo.'),
                      )
                    }
                  >
                    <Icone icone={Trash2} tamanho={18} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

function NovoGastoProjeto({ projetoId }: { projetoId: string }) {
  const salvarGasto = useSalvarGastoProjeto()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [aberto, setAberto] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [centavos, setCentavos] = useState(0)
  const [data, setData] = useState(hoje())
  const [erros, setErros] = useState<{ descricao?: string; valor?: string; data?: string }>({})

  if (!aberto) {
    return (
      <Botao icone={Plus} variante="secundario" onClick={() => setAberto(true)}>
        Adicionar gasto ao projeto
      </Botao>
    )
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    const novosErros = {
      descricao: descricao.trim() ? undefined : 'Descreva o gasto.',
      valor: centavos > 0 ? undefined : 'Digite um valor maior que zero.',
      data: dataValida(data) ? undefined : 'Escolha uma data válida.',
    }
    setErros(novosErros)
    if (Object.values(novosErros).some(Boolean)) return
    quandoTerminar(
      salvarGasto.mutateAsync({
        projeto_id: projetoId,
        descricao: descricao.trim(),
        valor_centavos: centavos,
        data,
      }),
      () => {
        mostrarAviso('Gasto adicionado ao projeto.')
        setDescricao('')
        setCentavos(0)
        setAberto(false)
      },
    )
  }

  return (
    <Card>
      <form noValidate onSubmit={salvar} className="flex flex-col gap-4">
        <h2 className="font-semibold">Novo gasto do projeto</h2>
        {salvarGasto.isError && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(salvarGasto.error)}
          </Alerta>
        )}
        <CampoValor centavos={centavos} aoMudar={setCentavos} erro={erros.valor} />
        <Campo
          rotulo="Descrição"
          placeholder="Ex.: Bolo, Decoração"
          maxLength={120}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao}
        />
        <Campo
          rotulo="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          erro={erros.data}
        />
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" carregando={salvarGasto.isPending}>
            Adicionar
          </Botao>
          <Botao variante="secundario" onClick={() => setAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Card>
  )
}

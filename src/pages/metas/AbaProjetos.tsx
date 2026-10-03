import { FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { Card } from '@/components/ui/Card'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { useProjetos } from '@/lib/dados/projetos'
import { progressoProjeto } from '@/lib/regras/resumo'
import { useFormatarValor } from '@/lib/valores'

import { FormProjeto } from './FormProjeto'

export function AbaProjetos() {
  const projetos = useProjetos()
  const formatar = useFormatarValor()
  const navegar = useNavigate()
  const [criando, setCriando] = useState(false)

  const ativos = projetos.data?.filter((p) => !p.arquivado) ?? []
  const arquivados = projetos.data?.filter((p) => p.arquivado) ?? []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-secundario">
        Eventos e objetivos com orçamento próprio. Ficam fora dos totais do mês e da meta de
        desnecessários.
      </p>
      {criando ? (
        <Card>
          <FormProjeto
            aoTerminar={(id) => {
              setCriando(false)
              if (id) void navegar(`/metas/projetos/${id}`)
            }}
          />
        </Card>
      ) : (
        <Botao icone={Plus} larguraTotal onClick={() => setCriando(true)}>
          Novo projeto
        </Botao>
      )}

      {projetos.isPending ? (
        <Carregando rotulo="Carregando projetos">
          <Esqueleto className="h-32 w-full rounded-card" />
        </Carregando>
      ) : projetos.isError ? (
        <EstadoErro erro={projetos.error} aoTentarDeNovo={() => void projetos.refetch()} />
      ) : projetos.data.length === 0 ? (
        !criando && (
          <EstadoVazio
            icone={FolderKanban}
            titulo="Nenhum projeto"
            descricao="Crie um projeto para acompanhar o orçamento de uma festa, viagem ou reforma."
            acao={<Botao onClick={() => setCriando(true)}>Criar projeto</Botao>}
          />
        )
      ) : (
        [
          { titulo: 'Em andamento', lista: ativos },
          { titulo: 'Arquivados', lista: arquivados },
        ]
          .filter((grupo) => grupo.lista.length > 0)
          .map((grupo) => (
            <section key={grupo.titulo} aria-label={grupo.titulo} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-secundario">{grupo.titulo}</h2>
              <ul className="flex flex-col gap-3">
                {grupo.lista.map((p) => {
                  const prog = progressoProjeto(p.total_centavos, p.orcamento_centavos)
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/metas/projetos/${p.id}`}
                        className="block rounded-card border border-borda bg-card p-4 hover:bg-fundo"
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate font-medium">{p.nome}</span>
                          <span className="valor shrink-0 font-semibold">
                            {formatar(p.total_centavos)}
                          </span>
                        </span>
                        {prog.percentual !== null && p.orcamento_centavos !== null ? (
                          <span className="mt-2 flex flex-col gap-1.5">
                            <BarraProgresso
                              rotulo={`Orçamento de ${p.nome}`}
                              percentual={prog.percentual}
                              cor={
                                prog.excedenteCentavos
                                  ? 'bg-desnecessario'
                                  : prog.alerta
                                    ? 'bg-alerta'
                                    : 'bg-destaque'
                              }
                            />
                            <span className="text-sm text-secundario">
                              {Math.round(prog.percentual)}% de {formatar(p.orcamento_centavos)}
                            </span>
                          </span>
                        ) : (
                          <span className="mt-1 block text-sm text-secundario">Sem orçamento</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
      )}
    </div>
  )
}

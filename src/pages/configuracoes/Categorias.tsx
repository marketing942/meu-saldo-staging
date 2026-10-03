import { CircleAlert, Plus, Tags, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { SeletorCor } from '@/components/formularios/CamposComuns'
import { Alerta } from '@/components/ui/Alerta'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { ConfirmarAcao } from '@/components/ui/ConfirmarAcao'
import { Carregando, Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { quandoTerminar } from '@/lib/dados/comum'
import {
  type Categoria,
  useCategorias,
  useExcluirCategoria,
  useSalvarCategoria,
} from '@/lib/dados/categorias'
import { mensagemDeErro } from '@/lib/erros'
import { useAvisos } from '@/stores/avisos'

import { CabecalhoConfig } from './comum'

export default function Categorias() {
  const categorias = useCategorias()
  const [editando, setEditando] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoConfig
        titulo="Categorias"
        descricao="Usadas para organizar e sugerir a categoria dos gastos."
        acao={
          editando !== 'nova' && (
            <Botao icone={Plus} onClick={() => setEditando('nova')}>
              Nova
            </Botao>
          )
        }
      />
      {editando === 'nova' && <FormCategoria aoTerminar={() => setEditando(null)} />}
      {categorias.isPending ? (
        <Carregando rotulo="Carregando categorias">
          <Esqueleto className="h-64 w-full rounded-card" />
        </Carregando>
      ) : categorias.isError ? (
        <EstadoErro erro={categorias.error} aoTentarDeNovo={() => void categorias.refetch()} />
      ) : categorias.data.length === 0 ? (
        <EstadoVazio
          icone={Tags}
          titulo="Nenhuma categoria"
          descricao="Crie categorias para organizar seus gastos."
          acao={<Botao onClick={() => setEditando('nova')}>Criar categoria</Botao>}
        />
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-borda">
            {categorias.data.map((categoria) => (
              <li key={categoria.id} className="py-2">
                {editando === categoria.id ? (
                  <FormCategoria original={categoria} aoTerminar={() => setEditando(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className="size-3 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      {categoria.nome}
                    </span>
                    <Botao
                      variante="texto"
                      className="text-sm"
                      onClick={() => setEditando(categoria.id)}
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

function FormCategoria({ original, aoTerminar }: { original?: Categoria; aoTerminar: () => void }) {
  const salvarCategoria = useSalvarCategoria()
  const excluir = useExcluirCategoria()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [nome, setNome] = useState(original?.nome ?? '')
  const [cor, setCor] = useState(original?.cor ?? '#6B7280')
  const [erro, setErro] = useState<string | undefined>()

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome à categoria.')
      return
    }
    setErro(undefined)
    try {
      await salvarCategoria.mutateAsync({ id: original?.id, nome: nome.trim(), cor })
      mostrarAviso(original ? 'Categoria atualizada.' : 'Categoria criada.')
      aoTerminar()
    } catch {
      // A mensagem aparece pelo estado de erro da mutation.
    }
  }

  const erroGravacao = salvarCategoria.error ?? excluir.error
  return (
    <form noValidate onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4 py-2">
      {erroGravacao && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(erroGravacao)}
        </Alerta>
      )}
      <Campo
        rotulo={original ? 'Nome da categoria' : 'Nova categoria'}
        maxLength={40}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erro}
      />
      <SeletorCor valor={cor} aoMudar={setCor} />
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvarCategoria.isPending}>
          Salvar
        </Botao>
        <Botao variante="secundario" onClick={aoTerminar}>
          Cancelar
        </Botao>
      </div>
      {original && (
        <ConfirmarAcao
          rotulo="Excluir categoria"
          icone={Trash2}
          pergunta="Excluir esta categoria? Os gastos dela ficam sem categoria."
          rotuloConfirmar="Excluir"
          carregando={excluir.isPending}
          aoConfirmar={() =>
            quandoTerminar(excluir.mutateAsync(original.id), () => {
              mostrarAviso('Categoria excluída.')
              aoTerminar()
            })
          }
        />
      )}
    </form>
  )
}

import { useEffect } from 'react'
import { useRouteError } from 'react-router'

import { EstadoErro } from '@/components/ui/EstadoErro'
import { registrarErro } from '@/lib/monitoramento'

/**
 * Erro inesperado ao montar uma tela. Erro ao baixar um pedaço do app
 * (nova versão publicada) também cai aqui: recarregar resolve.
 */
export function ErroDeRota() {
  const erro = useRouteError()

  useEffect(() => {
    registrarErro(erro, { origem: 'rota' })
  }, [erro])

  return (
    <main className="mx-auto flex min-h-dvh max-w-app items-center pt-seguro px-seguro">
      <EstadoErro
        className="w-full"
        mensagem="Não foi possível abrir esta tela. Pode ser uma nova versão do app ou uma falha de conexão."
        aoTentarDeNovo={() => window.location.reload()}
      />
    </main>
  )
}

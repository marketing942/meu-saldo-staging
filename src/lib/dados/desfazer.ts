import { useAvisos } from '@/stores/avisos'

import { queryClient } from '../queryClient'

/**
 * Ação do botão "Desfazer" de um aviso. Roda fora do ciclo de vida da tela
 * (o formulário já fechou quando o usuário toca em Desfazer) e recarrega os dados.
 */
export function desfazerCom(acao: () => PromiseLike<{ error: unknown }>) {
  return () => {
    void (async () => {
      const { error } = await acao()
      await queryClient.invalidateQueries()
      if (error) useAvisos.getState().mostrar('Não foi possível desfazer. Tente de novo.')
    })()
  }
}

/**
 * Converte erros do Supabase, da rede e do banco em mensagens claras em português.
 * Os códigos do Postgres vêm das constraints e gatilhos das migrations.
 */
interface ErroComCodigo {
  code?: string
  message?: string
  status?: number
}

function temCodigo(erro: unknown): erro is ErroComCodigo {
  return typeof erro === 'object' && erro !== null && ('code' in erro || 'message' in erro)
}

export function ehErroDeRede(erro: unknown): boolean {
  if (erro instanceof TypeError && /fetch|network|load failed/i.test(erro.message)) return true
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function mensagemDeErro(erro: unknown): string {
  if (ehErroDeRede(erro)) {
    return 'Sem conexão com a internet. Confira sua rede e tente de novo.'
  }
  if (temCodigo(erro)) {
    switch (erro.code) {
      case '23505':
        return 'Já existe um registro igual a este.'
      case '23514':
      case '22023':
      case '22007':
        return 'Algum valor não foi aceito. Revise os campos e tente de novo.'
      case '23503':
        return 'Um dos itens escolhidos não existe mais. Atualize a tela e tente de novo.'
      case '42501':
      case 'PGRST301':
        return 'Sua sessão expirou. Entre de novo para continuar.'
      default:
        break
    }
  }
  return 'Algo deu errado. Tente de novo em instantes.'
}

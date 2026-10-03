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

/** Ao excluir um item que ainda tem lançamentos ligados (chave estrangeira). */
export function mensagemAoExcluir(erro: unknown, comLancamentos: string): string {
  if (temCodigo(erro) && erro.code === '23503') return comLancamentos
  return mensagemDeErro(erro)
}

/** Mensagens para erros do Supabase Auth (entrar, cadastrar, sair). */
export function mensagemDeErroAuth(erro: unknown): string {
  if (ehErroDeRede(erro)) return mensagemDeErro(erro)
  if (typeof erro !== 'object' || erro === null) return mensagemDeErro(erro)

  const { code, status, name } = erro as ErroComCodigo & { name?: string }
  if (name === 'AuthRetryableFetchError') {
    return 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.'
  }
  switch (code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed':
      return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Este e-mail já tem cadastro. Entre com sua senha.'
    case 'weak_password':
      return 'Senha fraca. Use pelo menos 6 caracteres.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Confira o e-mail digitado.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Novos cadastros estão desativados no momento.'
    default:
      break
  }
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  return mensagemDeErro(erro)
}

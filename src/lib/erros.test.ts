import { describe, expect, it } from 'vitest'

import { mensagemDeErroAuth } from './erros'

describe('mensagemDeErroAuth', () => {
  it('traduz os erros comuns de entrar e cadastrar', () => {
    expect(mensagemDeErroAuth({ code: 'invalid_credentials', status: 400 })).toBe(
      'E-mail ou senha incorretos.',
    )
    expect(mensagemDeErroAuth({ code: 'user_already_exists', status: 422 })).toBe(
      'Este e-mail já tem cadastro. Entre com sua senha.',
    )
    expect(mensagemDeErroAuth({ code: 'email_not_confirmed', status: 400 })).toMatch(/Confirme/)
  })

  it('trata limite de tentativas e falha de conexão', () => {
    expect(mensagemDeErroAuth({ status: 429, message: 'x' })).toMatch(/Muitas tentativas/)
    expect(mensagemDeErroAuth({ name: 'AuthRetryableFetchError', message: 'x' })).toMatch(
      /servidor/,
    )
  })

  it('cai na mensagem genérica quando não reconhece o erro', () => {
    expect(mensagemDeErroAuth({ code: 'algo_novo', message: 'x' })).toBe(
      'Algo deu errado. Tente de novo em instantes.',
    )
  })
})

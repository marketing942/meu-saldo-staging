import type * as SentryReact from '@sentry/react'

import { env } from './env'

/**
 * Monitoramento de erros com Sentry, opcional: só liga se VITE_SENTRY_DSN estiver definida.
 * O SDK é carregado sob demanda (não pesa no bundle de quem não usa).
 * Nenhum dado pessoal é enviado: sem dados do usuário, cookies, cabeçalhos, corpos de
 * requisição ou parâmetros de URL, e sem replays de sessão.
 */
type SentryModulo = typeof SentryReact

let sentry: SentryModulo | null = null

export async function iniciarMonitoramento(): Promise<void> {
  if (!env.VITE_SENTRY_DSN) return
  const modulo = await import('@sentry/react')
  modulo.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_AMBIENTE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    beforeSend(evento) {
      // Remove identificadores do usuário e parâmetros de URL (podem ter tokens).
      delete evento.user
      if (evento.request?.url) evento.request.url = evento.request.url.split('?')[0]
      return evento
    },
  })
  sentry = modulo
}

export function registrarErro(erro: unknown, contexto?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(erro, contexto ? { extra: contexto } : undefined)
    return
  }
  if (import.meta.env.DEV) console.error(erro, contexto)
}

import { useQueryClient } from '@tanstack/react-query'

/**
 * Resolve uma consulta do Supabase: devolve os dados ou lança o erro (que a
 * tela mostra com mensagemDeErro). Os builders do supabase-js são "thenables".
 */
export async function dados<T>(
  consulta: PromiseLike<{ data: T | null; error: Error | null }>,
): Promise<T> {
  const { data, error } = await consulta
  if (error) throw error
  return data as T
}

/** Campos que as RPCs podem devolver nulos (os tipos gerados não marcam). */
export type Anulavel<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null }

/**
 * Depois de gravar, recarrega o que estiver na tela. Saldo, resumo, faturas e
 * dívidas dependem de quase tudo, então invalidar tudo é o caminho seguro.
 */
export function useAtualizarTudo() {
  const cliente = useQueryClient()
  return () => cliente.invalidateQueries()
}

/** Marca de exclusão lógica (deleted_at). */
export function agoraISO(): string {
  return new Date().toISOString()
}

/**
 * Roda `depois` quando a gravação termina. Diferente do onSuccess de mutate(),
 * funciona mesmo se a tela se remontar com os dados novos (o callback de mutate
 * é descartado quando o componente desmonta). Em caso de erro roda `seFalhar`;
 * a mensagem detalhada continua no estado da mutation.
 */
export function quandoTerminar<T>(
  promessa: Promise<T>,
  depois: (resultado: T) => void,
  seFalhar?: () => void,
): void {
  promessa.then(depois, () => seFalhar?.())
}

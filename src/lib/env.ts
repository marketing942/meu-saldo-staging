import { z } from 'zod'

// A CSP do app proíbe eval: sem isto, o Zod testa `new Function` e o navegador
// registra uma violação de CSP (inofensiva, mas polui o console e o monitoramento).
z.config({ jitless: true })

/**
 * Variáveis de ambiente (por ambiente, definidas na Vercel e no .env.local).
 * Só entram no bundle variáveis com prefixo VITE_. A chave service_role NUNCA vai para o front.
 */
const esquema = z.object({
  VITE_SUPABASE_URL: z.url({ message: 'VITE_SUPABASE_URL precisa ser a URL do projeto Supabase.' }),
  VITE_SUPABASE_ANON_KEY: z
    .string({ message: 'VITE_SUPABASE_ANON_KEY não foi definida.' })
    .min(20, 'VITE_SUPABASE_ANON_KEY parece incompleta.'),
  VITE_APP_AMBIENTE: z.enum(['local', 'staging', 'producao']).default('local'),
  VITE_SENTRY_DSN: z.union([z.url(), z.literal('')]).optional(),
})

export type Ambiente = z.infer<typeof esquema>

type ResultadoAmbiente = { ok: true; ambiente: Ambiente } | { ok: false; problemas: string[] }

export function validarAmbiente(
  fonte: Record<string, unknown> = import.meta.env,
): ResultadoAmbiente {
  const resultado = esquema.safeParse(fonte)
  if (resultado.success) return { ok: true, ambiente: resultado.data }
  return { ok: false, problemas: resultado.error.issues.map((issue) => issue.message) }
}

function carregar(): Ambiente {
  const resultado = validarAmbiente()
  if (!resultado.ok) {
    throw new Error(`Configuração inválida: ${resultado.problemas.join(' ')}`)
  }
  return resultado.ambiente
}

/** Use só depois de validarAmbiente() ter passado (ver main.tsx). */
export const env = carregar()

/** "Carregar/Limpar dados de exemplo" só aparece fora de produção. */
export const permiteDadosDeExemplo = env.VITE_APP_AMBIENTE !== 'producao'

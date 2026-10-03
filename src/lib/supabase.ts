import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { env } from './env'

/**
 * Cliente único do Supabase, tipado com os tipos gerados (npm run gen:types).
 * Usa só a chave pública (anon): quem protege os dados é o RLS no banco.
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Tabelas = Database['public']['Tables']
export type Linha<T extends keyof Tabelas> = Tabelas[T]['Row']
export type NovaLinha<T extends keyof Tabelas> = Tabelas[T]['Insert']
export type AlteracaoLinha<T extends keyof Tabelas> = Tabelas[T]['Update']
export type Enums = Database['public']['Enums']
export type Funcoes = Database['public']['Functions']

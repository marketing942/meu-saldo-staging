/** Mínimo exigido pelo Supabase Auth do projeto (supabase/config.toml). */
export const SENHA_MINIMO = 6

/** Checagem simples só para avisar antes de enviar; o Supabase valida de verdade. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

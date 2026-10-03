import { supabase } from '../supabase'

/**
 * Exclui a conta do usuário logado pela Edge Function `excluir-conta` (ela usa a
 * chave service_role, que nunca vem para o front). Apagar o usuário do Auth
 * apaga todos os dados em cascata.
 */
export async function excluirMinhaConta(): Promise<void> {
  const resultado = await supabase.functions.invoke<{ ok: boolean }>('excluir-conta', {
    method: 'POST',
  })
  if (resultado.error) throw resultado.error
  // O usuário não existe mais: só limpa a sessão local.
  await supabase.auth.signOut({ scope: 'local' })
}

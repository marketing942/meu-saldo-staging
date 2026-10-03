// Edge Function: exclui a conta do usuário que fez a chamada.
//
// Por que existe: apagar um usuário do Auth exige a chave service_role, que
// nunca pode ir para o front-end. Aqui ela vem do ambiente do próprio Supabase
// (SUPABASE_SERVICE_ROLE_KEY é injetada automaticamente nas Edge Functions).
// Apagar o usuário apaga todos os dados dele em cascata (on delete cascade).
//
// Deploy: npx supabase functions deploy excluir-conta --project-ref <ref>
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(corpo: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta({ erro: 'Sessão ausente.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chaveServico) return resposta({ erro: 'Função sem configuração.' }, 500)

  const admin = createClient(url, chaveServico, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Quem é o dono do token? Só ele pode ser apagado; nenhum id vem do cliente.
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return resposta({ erro: 'Sessão inválida.' }, 401)

  const { error: erroExclusao } = await admin.auth.admin.deleteUser(data.user.id)
  if (erroExclusao) {
    console.error('excluir-conta', erroExclusao.message)
    return resposta({ erro: 'Não foi possível excluir a conta.' }, 500)
  }
  return resposta({ ok: true }, 200)
})

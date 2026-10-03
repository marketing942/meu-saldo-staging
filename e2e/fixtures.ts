import { type Page, test as base, expect } from '@playwright/test'

import { SupabaseFalso } from './supabase-falso'

/** Cada teste ganha um Supabase falso novo, já interceptando as chamadas do app. */
export const test = base.extend<{ banco: SupabaseFalso }>({
  banco: [
    async ({ context }, usar) => {
      const banco = new SupabaseFalso()
      await banco.instalar(context)
      await usar(banco)
    },
    // Automático: nenhum teste chega ao Supabase de verdade.
    { auto: true },
  ],
})

export { expect }

export async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Usuário com o primeiro acesso concluído, já logado e no Início. */
export async function usuarioLogado(page: Page, banco: SupabaseFalso, nome = 'Ana Teste') {
  const usuario = banco.criarUsuario('ana@exemplo.com', 'senha123', nome, true)
  await entrar(page, usuario.email, usuario.senha)
  await expect(page.getByText('Saldo total')).toBeVisible()
  return {
    ...usuario,
    carteira: banco.linhas('contas', usuario.id)[0]?.id ?? '',
    categoria: (nomeCategoria: string) =>
      banco.linhas('categorias', usuario.id).find((c) => c.nome === nomeCategoria)?.id ?? null,
  }
}

/** Digita um valor no campo de dinheiro (dígitos entram pela direita: 4590 = 45,90). */
export async function digitarValor(page: Page, rotulo: string | RegExp, centavos: string) {
  const campo = page.getByLabel(rotulo)
  await campo.fill('')
  await campo.pressSequentially(centavos)
}

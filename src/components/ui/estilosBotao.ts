export type VarianteBotao = 'principal' | 'secundario' | 'texto' | 'perigo'

export const ESTILOS_BOTAO: Record<VarianteBotao, string> = {
  principal: 'rounded-botao bg-destaque text-sobre-destaque px-5 font-semibold hover:opacity-90',
  secundario:
    'rounded-botao border border-borda bg-card text-texto px-5 font-medium hover:bg-fundo',
  texto: 'rounded-botao px-2 font-medium text-destaque hover:underline underline-offset-4',
  perigo:
    'rounded-botao border border-desnecessario/40 bg-desnecessario/10 text-desnecessario px-5 font-semibold hover:bg-desnecessario/15',
}

export const BASE_BOTAO =
  'inline-flex min-h-11 items-center justify-center gap-2 text-[15px] transition-opacity disabled:opacity-50'

import type { Enums } from '@/lib/supabase'

export const ROTULO_ORIGEM: Record<Enums['origem_gasto'], string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
}

export const ROTULO_TIPO: Record<Enums['tipo_gasto'], string> = {
  necessario: 'Necessário',
  desnecessario: 'Desnecessário',
}

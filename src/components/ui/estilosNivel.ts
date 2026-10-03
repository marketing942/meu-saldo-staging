import type { NivelAlerta } from '@/lib/regras/resumo'

/**
 * Cores da previsão de desnecessários: verde abaixo de 70%, amarelo a partir de
 * 70%, laranja a partir de 90% e vermelho a partir de 100%.
 */
export function corDaBarraDoNivel(nivel: NivelAlerta): string {
  switch (nivel) {
    case 'estourou':
      return 'bg-desnecessario'
    case 'forte':
      return 'bg-forte'
    case 'atencao':
      return 'bg-alerta'
    default:
      return 'bg-necessario'
  }
}

/** Tom do <Alerta> para cada nível (só os níveis que geram alerta). */
export function tomDoNivel(nivel: NivelAlerta): 'alerta' | 'forte' | 'desnecessario' {
  if (nivel === 'estourou') return 'desnecessario'
  if (nivel === 'forte') return 'forte'
  return 'alerta'
}

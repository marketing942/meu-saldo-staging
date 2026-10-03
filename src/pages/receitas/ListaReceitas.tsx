import { Link } from 'react-router'

import { Card } from '@/components/ui/Card'
import type { Receita } from '@/lib/dados/receitas'
import { formatarData } from '@/lib/datas'
import { useFormatarValor } from '@/lib/valores'

/** Lista de receitas; cada linha abre a edição. */
export function ListaReceitas({ receitas }: { receitas: readonly Receita[] }) {
  const formatar = useFormatarValor()
  return (
    <Card className="py-1">
      <ul className="divide-y divide-borda">
        {receitas.map((receita) => (
          <li key={receita.id}>
            <Link
              to={`/receitas/${receita.id}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-campo px-2 py-3 hover:bg-fundo"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{receita.descricao}</p>
                <p className="text-sm text-secundario">{formatarData(receita.data)}</p>
              </div>
              <span className="valor shrink-0 font-semibold text-necessario">
                + {formatar(receita.valor_centavos)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

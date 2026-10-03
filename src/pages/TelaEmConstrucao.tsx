import { Hammer } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Botao } from '@/components/ui/Botao'
import { EstadoVazio } from '@/components/ui/EstadoVazio'

/**
 * Tela das fases seguintes do roteiro de entrega. Cada rota que usa este
 * componente é trocada pela tela definitiva na fase indicada (ver src/app/router.tsx).
 */
export function TelaEmConstrucao({ titulo, fase }: { titulo: string; fase: number }) {
  const navegar = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <EstadoVazio
        icone={Hammer}
        titulo="Esta tela chega em breve"
        descricao={`${titulo} faz parte da fase ${fase} da entrega.`}
        acao={
          <Botao variante="secundario" onClick={() => void navegar('/')}>
            Voltar ao Início
          </Botao>
        }
      />
    </div>
  )
}

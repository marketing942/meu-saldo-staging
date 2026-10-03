import { MapPinOff } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Botao } from '@/components/ui/Botao'
import { EstadoVazio } from '@/components/ui/EstadoVazio'

export default function NaoEncontrada() {
  const navegar = useNavigate()
  return (
    <EstadoVazio
      icone={MapPinOff}
      titulo="Página não encontrada"
      descricao="O endereço pode ter mudado ou não existe mais."
      acao={<Botao onClick={() => void navegar('/')}>Ir para o Início</Botao>}
    />
  )
}

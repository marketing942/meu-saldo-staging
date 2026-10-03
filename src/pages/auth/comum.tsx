import { MARCA } from '@/config/marca'

/** Topo das telas de entrar e cadastro. */
export function CabecalhoAuth({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="flex flex-col gap-1 pt-6">
      <p className="text-sm font-semibold text-destaque">{MARCA.nome}</p>
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-sm text-secundario">{subtitulo}</p>
    </header>
  )
}

export function BotaoMostrarSenha({
  visivel,
  aoAlternar,
}: {
  visivel: boolean
  aoAlternar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-pressed={visivel}
      className="min-h-11 rounded-botao px-3 text-sm font-medium text-destaque"
    >
      {visivel ? 'Ocultar' : 'Mostrar'}
    </button>
  )
}

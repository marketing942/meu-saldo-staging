import { LogoMarca } from '@/components/ui/Marca'

/** Topo das telas de entrar, cadastro e senha: logo completa e título. */
export function CabecalhoAuth({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="flex flex-col gap-1 pt-8">
      <LogoMarca className="mx-auto mb-6 h-18 w-auto" />
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

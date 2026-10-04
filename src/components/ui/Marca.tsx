import { MARCA } from '@/config/marca'
import { cn } from '@/lib/cn'

type ImagemDaMarca = (typeof MARCA)['logo'] | (typeof MARCA)['simbolo']

/**
 * As duas variantes da imagem (tema claro e escuro). O CSS (.marca-claro /
 * .marca-escuro em global.css) mostra só a do tema atual; com loading="lazy", a
 * escondida nem é baixada.
 */
function Imagem({ imagem, className }: { imagem: ImagemDaMarca; className?: string }) {
  return (
    <>
      {(['claro', 'escuro'] as const).map((tema) => (
        <img
          key={tema}
          src={imagem[tema]}
          alt={MARCA.nome}
          width={imagem.largura}
          height={imagem.altura}
          loading="lazy"
          decoding="async"
          className={cn(`marca-${tema}`, className)}
        />
      ))}
    </>
  )
}

/** Logo completa (símbolo + "Meu Saldo"): só nas telas de entrar, cadastro e senha. */
export function LogoMarca({ className }: { className?: string }) {
  return <Imagem imagem={MARCA.logo} className={className} />
}

/** Símbolo isolado: cabeçalho da área logada. */
export function SimboloMarca({ className }: { className?: string }) {
  return <Imagem imagem={MARCA.simbolo} className={className} />
}

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { Botao } from '@/components/ui/Botao'
import { Card } from '@/components/ui/Card'
import { MARCA } from '@/config/marca'
import { useVoltar } from '@/lib/navegacao'

/** Moldura dos textos legais (termos e privacidade). */
export function Documento({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string
  atualizadoEm: string
  children: ReactNode
}) {
  const voltar = useVoltar('/')
  return (
    <article className="flex flex-col gap-4 pt-2">
      <Botao variante="texto" icone={ArrowLeft} onClick={voltar} className="self-start">
        Voltar
      </Botao>
      <header>
        <p className="text-sm font-semibold text-destaque">{MARCA.nome}</p>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-secundario">Última atualização: {atualizadoEm}</p>
      </header>
      <Card className="flex flex-col gap-4 text-[15px] leading-relaxed [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </Card>
    </article>
  )
}

/** "pelo e-mail x@y" quando configurado em MARCA.emailContato. */
export function Contato() {
  // string (e não o literal '' de MARCA) para o texto funcionar quando o e-mail for preenchido.
  const email: string = MARCA.emailContato
  return email ? (
    <>
      pelo e-mail{' '}
      <a className="font-medium text-destaque underline" href={`mailto:${email}`}>
        {email}
      </a>
    </>
  ) : (
    <>pelos canais de contato informados no app</>
  )
}

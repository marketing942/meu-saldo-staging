import { MARCA } from '@/config/marca'

/**
 * Mostrado quando faltam variáveis de ambiente (ex.: deploy sem VITE_SUPABASE_URL).
 * Não depende do Supabase nem do roteador, que não podem ser criados sem elas.
 */
export function ErroDeConfiguracao({ problemas }: { problemas: string[] }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col justify-center gap-4 pt-seguro px-seguro">
      <h1 className="text-xl font-semibold">{MARCA.nome} não está configurado</h1>
      <div role="alert" className="rounded-card border border-alerta/30 bg-alerta/12 p-4 text-sm">
        <p className="mb-2 font-medium">Confira as variáveis de ambiente deste deploy:</p>
        <ul className="list-disc space-y-1 pl-5">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-secundario">
        Veja o passo a passo no README, na seção “Variáveis de ambiente”.
      </p>
    </main>
  )
}

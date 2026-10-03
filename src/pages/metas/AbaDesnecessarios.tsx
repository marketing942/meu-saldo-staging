import { CircleAlert, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card, TituloCard } from '@/components/ui/Card'
import { Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { quandoTerminar } from '@/lib/dados/comum'
import { useAtualizarPerfil, usePerfil } from '@/lib/dados/perfil'
import { useResumoMes } from '@/lib/dados/resumo'
import { formatarNomeMes } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useMes } from '@/lib/mes'
import { nivelDoPercentual } from '@/lib/regras/resumo'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

const TEXTO_NIVEL = {
  'sem-meta': '',
  ok: 'Dentro da meta.',
  atencao: 'Atenção: passou de 70% da meta.',
  forte: 'Cuidado: passou de 90% da meta.',
  estourou: 'Meta ultrapassada.',
} as const

export function AbaDesnecessarios() {
  const mes = useMes()
  const perfil = usePerfil()
  const resumo = useResumoMes(mes)
  const formatar = useFormatarValor()

  if (perfil.isPending) return <Esqueleto className="h-56 w-full rounded-card" />
  if (perfil.isError) {
    return <EstadoErro erro={perfil.error} aoTentarDeNovo={() => void perfil.refetch()} />
  }
  const meta = perfil.data?.meta_desnecessario_centavos ?? null
  const r = resumo.data
  const pct = r?.desnecessario_percentual ?? null
  const nivel = nivelDoPercentual(pct)

  return (
    <div className="flex flex-col gap-4">
      <FormMetaDesnecessarios key={meta ?? 0} meta={meta} />
      {meta !== null && r && (
        <Card className="flex flex-col gap-3">
          <TituloCard>Desnecessários em {formatarNomeMes(mes)}</TituloCard>
          <div className="flex items-baseline justify-between gap-3">
            <p className="valor text-2xl font-semibold text-desnecessario">
              {formatar(r.desnecessario_centavos)}
            </p>
            <p className="text-sm text-secundario">de {formatar(meta)}</p>
          </div>
          <BarraProgresso
            rotulo="Uso da meta de desnecessários"
            percentual={pct ?? 0}
            marcos={[70, 90]}
            cor={
              nivel === 'estourou'
                ? 'bg-desnecessario'
                : nivel === 'ok'
                  ? 'bg-necessario'
                  : 'bg-alerta'
            }
          />
          <p className="text-sm">
            <span className="font-semibold">{Math.round(pct ?? 0)}%</span> · {TEXTO_NIVEL[nivel]}
          </p>
          {r.desnecessario_projecao_centavos !== null && (
            <p className="text-sm text-secundario">
              No ritmo atual, o mês fecha em {formatar(r.desnecessario_projecao_centavos)}
              {r.desnecessario_dias_para_estourar !== null &&
                ` e passa da meta em ~${r.desnecessario_dias_para_estourar} dias`}
              .
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function FormMetaDesnecessarios({ meta }: { meta: number | null }) {
  const atualizar = useAtualizarPerfil()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [valor, setValor] = useState(meta ?? 0)

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    quandoTerminar(
      atualizar.mutateAsync({ meta_desnecessario_centavos: valor > 0 ? valor : null }),
      () => mostrarAviso(valor > 0 ? 'Meta salva.' : 'Meta removida.'),
    )
  }

  return (
    <Card>
      <form onSubmit={salvar} className="flex flex-col gap-3">
        <TituloCard>Meta mensal de gastos desnecessários</TituloCard>
        {atualizar.isError && (
          <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
            {mensagemDeErro(atualizar.error)}
          </Alerta>
        )}
        <CampoValor rotulo="Limite por mês (R$)" centavos={valor} aoMudar={setValor} />
        <p className="text-sm text-secundario">
          Você recebe avisos no Início aos 70%, 90% e 100% desse valor. Deixe zerado para não usar
          meta.
        </p>
        <Botao
          type="submit"
          icone={ShieldCheck}
          carregando={atualizar.isPending}
          className="self-start"
        >
          Salvar meta
        </Botao>
      </form>
    </Card>
  )
}

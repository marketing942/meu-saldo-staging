import { CircleAlert, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Alerta } from '@/components/ui/Alerta'
import { BarraProgresso } from '@/components/ui/BarraProgresso'
import { Botao } from '@/components/ui/Botao'
import { CampoValor } from '@/components/ui/CampoValor'
import { Card, TituloCard } from '@/components/ui/Card'
import { Esqueleto } from '@/components/ui/Esqueleto'
import { EstadoErro } from '@/components/ui/EstadoErro'
import { corDaBarraDoNivel } from '@/components/ui/estilosNivel'
import { cn } from '@/lib/cn'
import { quandoTerminar } from '@/lib/dados/comum'
import { useAtualizarPerfil, usePerfil } from '@/lib/dados/perfil'
import { type ResumoMes, useResumoMes } from '@/lib/dados/resumo'
import { nomeMesMinusculo } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { useMes } from '@/lib/mes'
import { nivelDoPercentual } from '@/lib/regras/resumo'
import { useFormatarValor } from '@/lib/valores'
import { useAvisos } from '@/stores/avisos'

const TEXTO_NIVEL = {
  'sem-meta': '',
  ok: 'Dentro da previsão.',
  atencao: 'Atenção: passou de 70% da previsão.',
  forte: 'Cuidado: passou de 90% da previsão.',
  estourou: 'Previsão ultrapassada.',
} as const

/**
 * Card "Previsão de desnecessários": o valor fica no perfil
 * (meta_desnecessario_centavos) e vale para todos os meses.
 */
export function PrevisaoDesnecessarios() {
  const mes = useMes()
  const perfil = usePerfil()
  const resumo = useResumoMes(mes)

  if (perfil.isPending) return <Esqueleto className="h-72 w-full rounded-card" />
  if (perfil.isError) {
    return <EstadoErro erro={perfil.error} aoTentarDeNovo={() => void perfil.refetch()} />
  }
  const previsao = perfil.data?.meta_desnecessario_centavos ?? null

  return (
    <Card className="flex flex-col gap-4">
      <TituloCard className="text-base text-texto">Previsão de desnecessários</TituloCard>
      <FormPrevisao key={previsao ?? 0} previsao={previsao} />
      {previsao !== null && resumo.data && (
        <ProgressoDoMes previsao={previsao} resumo={resumo.data} />
      )}
    </Card>
  )
}

function FormPrevisao({ previsao }: { previsao: number | null }) {
  const atualizar = useAtualizarPerfil()
  const mostrarAviso = useAvisos((a) => a.mostrar)
  const [valor, setValor] = useState(previsao ?? 0)

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    quandoTerminar(
      atualizar.mutateAsync({ meta_desnecessario_centavos: valor > 0 ? valor : null }),
      () => mostrarAviso(valor > 0 ? 'Previsão salva.' : 'Previsão removida.'),
    )
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {atualizar.isError && (
        <Alerta tom="desnecessario" icone={CircleAlert} anunciar>
          {mensagemDeErro(atualizar.error)}
        </Alerta>
      )}
      <CampoValor
        rotulo="Quanto prevejo gastar com desnecessários por mês (R$)"
        centavos={valor}
        aoMudar={setValor}
      />
      <p className="text-sm text-secundario">
        Você recebe avisos no Início aos 70%, 90% e 100% desse valor. Deixe zerado para não usar a
        previsão.
      </p>
      <Botao
        type="submit"
        icone={ShieldCheck}
        carregando={atualizar.isPending}
        className="self-start"
      >
        Salvar previsão
      </Botao>
    </form>
  )
}

function ProgressoDoMes({ previsao, resumo }: { previsao: number; resumo: ResumoMes }) {
  const formatar = useFormatarValor()
  const gasto = resumo.desnecessario_centavos
  const pct = resumo.desnecessario_percentual ?? 0
  const nivel = nivelDoPercentual(resumo.desnecessario_percentual)
  const dias = resumo.desnecessario_dias_para_estourar

  return (
    <div className="flex flex-col gap-3 border-t border-borda pt-4">
      <p className="text-sm font-medium text-secundario">
        Desnecessários em {nomeMesMinusculo(resumo.mes_ref)}
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <p className="valor text-2xl font-semibold text-desnecessario">{formatar(gasto)}</p>
        <p className="text-sm text-secundario">
          de <span className="valor">{formatar(previsao)}</span>
        </p>
      </div>
      <BarraProgresso
        rotulo="Uso da previsão de desnecessários"
        percentual={pct}
        marcos={[70, 90]}
        cor={corDaBarraDoNivel(nivel)}
      />
      <p className="text-sm">
        <span className="font-semibold">{Math.round(pct)}%</span> · {TEXTO_NIVEL[nivel]}
      </p>
      <p className={cn('text-sm', gasto > previsao ? 'text-desnecessario' : 'text-necessario')}>
        {gasto > previsao
          ? `Você ultrapassou a previsão em ${formatar(gasto - previsao)}.`
          : `Ainda restam ${formatar(previsao - gasto)} na previsão deste mês.`}
      </p>
      {dias !== null && (
        <p className="text-sm font-medium">
          No ritmo atual, você passa da previsão em ~{dias} {dias === 1 ? 'dia' : 'dias'}.
        </p>
      )}
      {resumo.desnecessario_projecao_centavos !== null && (
        <p className="text-sm text-secundario">
          Projeção para o mês inteiro: {formatar(resumo.desnecessario_projecao_centavos)}.
        </p>
      )}
    </div>
  )
}

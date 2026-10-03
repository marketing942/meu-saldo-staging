import { type MesRef, dataNoMes, diaDe, hoje, mesAtual, mesDe, somarDias } from '../datas'
import { gerarParcelas } from '../regras/cartao'
import { supabase } from '../supabase'
import { dados } from './comum'

/**
 * Dados de exemplo para testar o app (só fora de produção). Tudo leva o sufixo
 * "(exemplo)" no nome ou na descrição, e é por ele que "Limpar" encontra o que apagar.
 */
export const SUFIXO_EXEMPLO = ' (exemplo)'
const PADRAO = '%(exemplo)'

const ex = (texto: string) => `${texto}${SUFIXO_EXEMPLO}`

// Inserts em lote mandam a união das colunas e o PostgREST preenche com NULL o
// que faltar em cada objeto (defaultToNull). Por isso todo objeto de um mesmo
// lote traz as mesmas colunas, inclusive as que têm default no banco.

/** Dia `n` atrás, sem sair do mês atual (no começo do mês, usa o dia 1). */
function diasAtras(n: number): string {
  const data = somarDias(hoje(), -n)
  return mesDe(data) === mesAtual() ? data : `${mesAtual()}-01`
}

export async function carregarDadosDeExemplo(uid: string, contaId: string): Promise<void> {
  const categorias = await dados(supabase.from('categorias').select('id, nome').eq('user_id', uid))
  const cat = (nome: string) => categorias.find((c) => c.nome === nome)?.id ?? null
  const mes: MesRef = mesAtual()

  const cartao = await dados<{ id: string }>(
    supabase
      .from('cartoes')
      .insert({
        user_id: uid,
        nome: ex('Cartão'),
        cor: '#5E5496',
        limite_centavos: 500_000,
        dia_fechamento: 5,
        dia_vencimento: 12,
      })
      .select('id')
      .single(),
  )

  await dados(
    supabase.from('receitas').insert([
      {
        user_id: uid,
        conta_id: contaId,
        descricao: ex('Salário'),
        valor_centavos: 450_000,
        data: `${mes}-01`,
      },
      {
        user_id: uid,
        conta_id: contaId,
        descricao: ex('Freela'),
        valor_centavos: 80_000,
        data: diasAtras(2),
      },
    ]),
  )

  const grupo = crypto.randomUUID()
  const parcelas = gerarParcelas(180_000, diasAtras(3), 6).map((p) => ({
    user_id: uid,
    descricao: ex('Celular novo'),
    valor_centavos: p.valorCentavos,
    data: p.data,
    origem: 'cartao' as const,
    conta_id: null,
    cartao_id: cartao.id,
    categoria_id: cat('Compras'),
    tipo: 'necessario' as const,
    parcela_atual: p.parcela,
    total_parcelas: 6,
    grupo_parcelas: grupo,
  }))
  const avulso = (
    descricao: string,
    valor: number,
    dias: number,
    origem: 'pix' | 'dinheiro' | 'cartao',
    categoria: string,
    tipo: 'necessario' | 'desnecessario',
  ) => ({
    user_id: uid,
    descricao: ex(descricao),
    valor_centavos: valor,
    data: diasAtras(dias),
    origem,
    conta_id: origem === 'cartao' ? null : contaId,
    cartao_id: origem === 'cartao' ? cartao.id : null,
    categoria_id: cat(categoria),
    tipo,
    parcela_atual: 1,
    total_parcelas: 1,
    grupo_parcelas: null,
  })
  await dados(
    supabase
      .from('gastos')
      .insert([
        avulso('Mercado', 23_450, 1, 'pix', 'Alimentação', 'necessario'),
        avulso('Uber', 3_290, 0, 'pix', 'Transporte', 'necessario'),
        avulso('iFood', 5_890, 0, 'dinheiro', 'Alimentação', 'desnecessario'),
        avulso('Cinema', 4_800, 4, 'cartao', 'Lazer', 'desnecessario'),
        avulso('Farmácia', 7_120, 5, 'pix', 'Saúde', 'necessario'),
        ...parcelas,
      ]),
  )

  const diaVenc = (dia: number) => diaDe(dataNoMes(mes, dia))
  await dados(
    supabase.from('dividas').insert([
      {
        user_id: uid,
        nome: ex('Financiamento do carro'),
        tipo: 'financiamento',
        valor_parcela_centavos: 89_000,
        dia_vencimento: diaVenc(15),
        infinita: false,
        total_parcelas: 48,
        parcelas_ja_pagas: 12,
        forma_pagamento: 'conta',
        conta_id: contaId,
        cartao_id: null,
      },
      {
        user_id: uid,
        nome: ex('Aluguel'),
        tipo: 'aluguel',
        valor_parcela_centavos: 150_000,
        dia_vencimento: diaVenc(10),
        infinita: true,
        total_parcelas: null,
        parcelas_ja_pagas: 0,
        forma_pagamento: 'conta',
        conta_id: contaId,
        cartao_id: null,
      },
      {
        user_id: uid,
        nome: ex('Streaming'),
        tipo: 'assinatura',
        valor_parcela_centavos: 3_990,
        dia_vencimento: diaVenc(20),
        infinita: true,
        total_parcelas: null,
        parcelas_ja_pagas: 0,
        forma_pagamento: 'cartao',
        conta_id: null,
        cartao_id: cartao.id,
      },
    ]),
  )

  const projeto = await dados<{ id: string }>(
    supabase
      .from('projetos')
      .insert({ user_id: uid, nome: ex('Viagem de férias'), orcamento_centavos: 500_000 })
      .select('id')
      .single(),
  )
  await dados(
    supabase.from('projeto_gastos').insert([
      {
        user_id: uid,
        projeto_id: projeto.id,
        descricao: ex('Passagens'),
        valor_centavos: 120_000,
        data: diasAtras(6),
      },
      {
        user_id: uid,
        projeto_id: projeto.id,
        descricao: ex('Hotel'),
        valor_centavos: 90_000,
        data: diasAtras(6),
      },
    ]),
  )
}

/** Apaga de vez tudo que tem o sufixo "(exemplo)". */
export async function limparDadosDeExemplo(uid: string): Promise<void> {
  // Ordem importa: gastos antes dos cartões (chave estrangeira).
  await dados(supabase.from('gastos').delete().eq('user_id', uid).like('descricao', PADRAO))
  await dados(supabase.from('receitas').delete().eq('user_id', uid).like('descricao', PADRAO))
  await dados(supabase.from('dividas').delete().eq('user_id', uid).like('nome', PADRAO))
  await dados(supabase.from('projetos').delete().eq('user_id', uid).like('nome', PADRAO))
  await dados(supabase.from('cartoes').delete().eq('user_id', uid).like('nome', PADRAO))
}

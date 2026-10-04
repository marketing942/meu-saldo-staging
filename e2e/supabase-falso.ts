/**
 * Supabase falso, em memória, para os testes E2E. Intercepta as chamadas do app
 * (Auth, PostgREST, RPCs e a Edge Function de excluir conta) e responde como o
 * servidor real. Os cálculos das RPCs usam as mesmas regras puras de
 * src/lib/regras, que espelham as funções SQL e têm testes próprios.
 *
 * Não substitui um teste contra o banco de verdade (RLS e SQL são testados com
 * pgTAP em supabase/tests); serve para exercitar as telas e o que elas enviam.
 */
import { randomUUID } from 'node:crypto'

import type { BrowserContext, Request, Route } from '@playwright/test'

import { type MesRef, dataNoMes, hoje, mesAtual, primeiroDia, ultimoDia } from '@/lib/datas'
import {
  comprometidoPorContasAPagar,
  faturaQueVenceNoMes,
  fechamentoFatura,
  limiteCartao,
  mesFatura,
  statusFatura,
  vencimentoFatura,
} from '@/lib/regras/cartao'
import {
  type DividaParaCalculo,
  dividaApareceNoMes,
  numeroParcelaDivida,
  pagaAntesDoCadastro,
  statusDivida,
  vencimentoDivida,
} from '@/lib/regras/dividas'
import {
  alertaDesnecessarios,
  diasDoMes,
  podeGastarPorDia,
  sobraNoMes,
  totaisGastosDoMes,
} from '@/lib/regras/resumo'
import { saldoConta } from '@/lib/regras/saldo'

export const URL_SUPABASE = 'https://e2e-ficticio.supabase.co'

type Valor = string | number | boolean | null
export type Linha = Record<string, Valor> & { id: string }

interface Usuario {
  id: string
  email: string
  senha: string
  nome: string
}

const TABELAS = [
  'profiles',
  'contas',
  'categorias',
  'cartoes',
  'gastos',
  'receitas',
  'faturas_pagas',
  'dividas',
  'dividas_pagamentos',
  'projetos',
  'projeto_gastos',
  'aprendizado_categoria',
] as const
type Tabela = (typeof TABELAS)[number]

/** Colunas NOT NULL (as com default inclusas), como nas migrations. */
const OBRIGATORIAS: Partial<Record<Tabela, string[]>> = {
  contas: ['nome', 'saldo_inicial_centavos'],
  categorias: ['nome', 'cor'],
  cartoes: ['nome', 'cor', 'limite_centavos', 'dia_fechamento', 'dia_vencimento', 'arquivado'],
  gastos: [
    'valor_centavos',
    'descricao',
    'data',
    'origem',
    'tipo',
    'parcela_atual',
    'total_parcelas',
  ],
  receitas: ['valor_centavos', 'descricao', 'data', 'conta_id'],
  faturas_pagas: ['cartao_id', 'mes_ref', 'conta_id', 'pago_em'],
  dividas: [
    'nome',
    'tipo',
    'valor_parcela_centavos',
    'dia_vencimento',
    'infinita',
    'parcelas_ja_pagas',
    'mes_inicio_ref',
    'forma_pagamento',
    'ativa',
  ],
  dividas_pagamentos: ['divida_id', 'mes_ref', 'pago_em', 'valor_centavos', 'forma_pagamento'],
  projetos: ['nome', 'descontar_do_saldo', 'arquivado'],
  projeto_gastos: ['projeto_id', 'descricao', 'valor_centavos', 'data'],
  aprendizado_categoria: ['termo', 'categoria_id', 'tipo'],
}

/** Unicidade (para upsert e erros 23505), como nas migrations. */
const UNICOS: Partial<Record<Tabela, string[]>> = {
  aprendizado_categoria: ['user_id', 'termo'],
  faturas_pagas: ['user_id', 'cartao_id', 'mes_ref'],
  dividas_pagamentos: ['divida_id', 'mes_ref'],
}

class ErroBanco extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

let relogio = 0
/** created_at sempre crescente, para a ordem por criação ser estável. */
const agora = () => {
  relogio = Math.max(Date.now(), relogio + 1)
  return new Date(relogio).toISOString()
}

const num = (v: Valor | undefined): number => (typeof v === 'number' ? v : Number(v ?? 0))
const str = (v: Valor | undefined): string => (v === null || v === undefined ? '' : String(v))

export class SupabaseFalso {
  usuarios: Usuario[] = []
  tabelas = Object.fromEntries(TABELAS.map((t) => [t, [] as Linha[]])) as Record<Tabela, Linha[]>
  /** true: o cadastro exige confirmar o e-mail (não devolve sessão). */
  confirmarEmail = false
  /** Chamadas recebidas (método e caminho), para os testes conferirem. */
  chamadas: { metodo: string; caminho: string; corpo: unknown }[] = []

  // Usuários --------------------------------------------------------------------

  /** Cria usuário como o Auth + gatilho handle_new_user (perfil, Carteira e 9 categorias). */
  criarUsuario(email: string, senha: string, nome = '', onboardingConcluido = false): Usuario {
    const usuario = { id: randomUUID(), email, senha, nome }
    this.usuarios.push(usuario)
    const uid = usuario.id
    this.tabelas.profiles.push({
      id: uid,
      nome,
      meta_desnecessario_centavos: null,
      tema: 'sistema',
      ocultar_valores: false,
      lembrete_diario: true,
      mes_selecionado: null,
      onboarding_concluido: onboardingConcluido,
      created_at: agora(),
      updated_at: agora(),
    })
    this.inserir(uid, 'contas', { nome: 'Carteira', saldo_inicial_centavos: 0 })
    const categorias: [string, string][] = [
      ['Alimentação', '#3C8D6A'],
      ['Moradia', '#2E4A7A'],
      ['Transporte', '#4F7CAC'],
      ['Lazer', '#C98F2E'],
      ['Compras', '#C65468'],
      ['Saúde', '#3F8F8F'],
      ['Educação', '#6F5AA8'],
      ['Assinaturas', '#8A6A3F'],
      ['Outros', '#6B7280'],
    ]
    for (const [n, cor] of categorias) this.inserir(uid, 'categorias', { nome: n, cor })
    return usuario
  }

  linhas(tabela: Tabela, uid: string): Linha[] {
    return this.tabelas[tabela].filter((l) =>
      tabela === 'profiles' ? l.id === uid : l.user_id === uid,
    )
  }

  // Escrita (com os gatilhos e constraints que importam para as telas) ---------------

  inserir(uid: string, tabela: Tabela, dados: Record<string, Valor>, upsert?: string[]): Linha {
    const linha: Linha = {
      id: str(dados.id) || randomUUID(),
      ...(tabela === 'profiles' ? {} : { user_id: uid }),
      created_at: agora(),
      updated_at: agora(),
      ...this.padroes(tabela),
      ...dados,
    }
    if (tabela === 'profiles' ? linha.id !== uid : linha.user_id !== uid) {
      throw new ErroBanco('42501', 'new row violates row-level security policy', 403)
    }
    this.preparar(uid, tabela, linha)
    const chave = upsert ?? UNICOS[tabela]
    if (chave) {
      const existente = this.tabelas[tabela].find((l) => chave.every((c) => l[c] === linha[c]))
      if (existente) {
        if (!upsert) throw new ErroBanco('23505', 'duplicate key value', 409)
        Object.assign(existente, dados, { updated_at: agora() })
        return existente
      }
    }
    if (tabela === 'profiles') {
      const perfil = this.tabelas.profiles.find((p) => p.id === linha.id)
      if (perfil) {
        Object.assign(perfil, dados)
        return perfil
      }
    }
    this.validar(tabela, linha)
    this.tabelas[tabela].push(linha)
    return linha
  }

  private padroes(tabela: Tabela): Record<string, Valor> {
    switch (tabela) {
      case 'gastos':
        return {
          data: hoje(),
          parcela_atual: 1,
          total_parcelas: 1,
          grupo_parcelas: null,
          conta_id: null,
          cartao_id: null,
          categoria_id: null,
          deleted_at: null,
        }
      case 'receitas':
        return { data: hoje(), deleted_at: null }
      case 'cartoes':
        return { cor: '#2E4A7A', arquivado: false }
      case 'categorias':
        return { cor: '#6B7280' }
      case 'contas':
        return { saldo_inicial_centavos: 0 }
      case 'dividas':
        return {
          tipo: 'outro',
          infinita: false,
          total_parcelas: null,
          parcelas_ja_pagas: 0,
          mes_inicio_ref: mesAtual(),
          forma_pagamento: 'conta',
          conta_id: null,
          cartao_id: null,
          ativa: true,
          deleted_at: null,
        }
      case 'dividas_pagamentos':
        return { pago_em: hoje(), conta_id: null, cartao_id: null, fatura_mes_ref: null }
      case 'faturas_pagas':
        return { pago_em: hoje() }
      case 'projetos':
        return {
          orcamento_centavos: null,
          descontar_do_saldo: false,
          conta_id: null,
          arquivado: false,
          deleted_at: null,
        }
      case 'projeto_gastos':
        return { data: hoje(), deleted_at: null }
      default:
        return {}
    }
  }

  /** Espelha os gatilhos *_preparar das migrations. */
  private preparar(uid: string, tabela: Tabela, linha: Linha, antes?: Linha) {
    if (tabela === 'gastos') {
      if (linha.origem !== 'cartao') linha.fatura_mes_ref = null
      else if (
        !antes ||
        antes.data !== linha.data ||
        antes.cartao_id !== linha.cartao_id ||
        antes.origem !== linha.origem
      ) {
        const cartao = this.linhas('cartoes', uid).find((c) => c.id === linha.cartao_id)
        if (!cartao) throw new ErroBanco('23503', 'Cartão não encontrado.', 409)
        linha.fatura_mes_ref = mesFatura(str(linha.data), num(cartao.dia_fechamento))
      }
    }
    if (tabela === 'aprendizado_categoria') {
      linha.termo = str(linha.termo).trim().replace(/\s+/g, ' ').toLowerCase()
    }
    if (tabela === 'projetos' && linha.descontar_do_saldo && !linha.conta_id) {
      linha.conta_id = this.linhas('contas', uid)[0]?.id ?? null
    }
    if (tabela === 'dividas' && antes) {
      if (
        antes.total_parcelas !== linha.total_parcelas ||
        antes.parcelas_ja_pagas !== linha.parcelas_ja_pagas ||
        antes.infinita !== linha.infinita
      ) {
        linha.mes_inicio_ref = mesAtual()
      }
    }
    if (tabela === 'dividas_pagamentos' && !antes) {
      const d = this.linhas('dividas', uid).find((x) => x.id === linha.divida_id && !x.deleted_at)
      if (!d) throw new ErroBanco('23503', 'Dívida não encontrada.', 409)
      const calc = paraCalculo(d)
      const n = numeroParcelaDivida(calc.parcelasJaPagas, calc.mesInicioRef, str(linha.mes_ref))
      if (
        calc.infinita
          ? str(linha.mes_ref) < calc.mesInicioRef
          : n <= calc.parcelasJaPagas || n > (calc.totalParcelas ?? 0)
      ) {
        throw new ErroBanco('22023', 'Não há parcela desta dívida para pagar nesse mês.')
      }
      linha.valor_centavos = d.valor_parcela_centavos ?? null
      linha.forma_pagamento = d.forma_pagamento ?? null
      linha.conta_id = d.conta_id ?? null
      linha.cartao_id = d.cartao_id ?? null
      linha.fatura_mes_ref = null
      if (d.forma_pagamento === 'cartao') {
        const cartao = this.linhas('cartoes', uid).find((c) => c.id === d.cartao_id)
        if (!cartao) throw new ErroBanco('23503', 'Cartão não encontrado.', 409)
        linha.fatura_mes_ref = mesFatura(
          dataNoMes(str(linha.mes_ref), num(d.dia_vencimento)),
          num(cartao.dia_fechamento),
        )
      }
    }
  }

  /** Algumas constraints, para pegar dados mal montados pelo app. */
  private validar(tabela: Tabela, l: Linha) {
    const falha = (msg: string) => {
      throw new ErroBanco('23514', `new row violates check constraint: ${msg}`)
    }
    for (const coluna of OBRIGATORIAS[tabela] ?? []) {
      if (l[coluna] === null || l[coluna] === undefined) {
        throw new ErroBanco(
          '23502',
          `null value in column "${coluna}" violates not-null constraint`,
        )
      }
    }
    if ('valor_centavos' in l && !(num(l.valor_centavos) > 0)) falha('valor_positivo')
    if (tabela === 'gastos') {
      if (!Number.isInteger(l.valor_centavos)) falha('valor inteiro')
      const ok =
        (l.origem === 'cartao' && l.cartao_id && !l.conta_id) ||
        (l.origem !== 'cartao' && l.conta_id && !l.cartao_id)
      if (!ok) falha('gastos_origem_coerente')
      if (num(l.total_parcelas) > 1 && !l.grupo_parcelas) falha('gastos_parcelado_tem_grupo')
    }
    if (tabela === 'dividas') {
      const ok = l.infinita
        ? l.total_parcelas === null && num(l.parcelas_ja_pagas) === 0
        : num(l.total_parcelas) >= 1 && num(l.parcelas_ja_pagas) < num(l.total_parcelas)
      if (!ok) falha('dividas_parcelas_validas')
      const forma =
        (l.forma_pagamento === 'conta' && l.conta_id && !l.cartao_id) ||
        (l.forma_pagamento === 'cartao' && l.cartao_id && !l.conta_id)
      if (!forma) falha('dividas_forma_coerente')
    }
    if (tabela === 'cartoes' && !(num(l.limite_centavos) > 0)) falha('cartoes_limite_positivo')
  }

  atualizar(uid: string, tabela: Tabela, linhas: Linha[], dados: Record<string, Valor>) {
    for (const linha of linhas) {
      const antes = { ...linha }
      Object.assign(linha, dados, { updated_at: agora() })
      this.preparar(uid, tabela, linha, antes)
      this.validar(tabela, linha)
    }
    return linhas
  }

  apagar(uid: string, tabela: Tabela, linhas: Linha[]) {
    const ids = new Set(linhas.map((l) => l.id))
    // Chaves estrangeiras sem cascata: conta e cartão com lançamentos não saem.
    if (tabela === 'contas' || tabela === 'cartoes') {
      const coluna = tabela === 'contas' ? 'conta_id' : 'cartao_id'
      const usadas: Tabela[] =
        tabela === 'contas'
          ? ['gastos', 'receitas', 'dividas', 'faturas_pagas', 'projetos']
          : ['gastos', 'dividas']
      if (usadas.some((t) => this.linhas(t, uid).some((l) => ids.has(str(l[coluna]))))) {
        throw new ErroBanco('23503', 'violates foreign key constraint', 409)
      }
    }
    this.tabelas[tabela] = this.tabelas[tabela].filter((l) => !ids.has(l.id))
    // Cascatas.
    if (tabela === 'dividas') {
      this.tabelas.dividas_pagamentos = this.tabelas.dividas_pagamentos.filter(
        (p) => !ids.has(str(p.divida_id)),
      )
    }
    if (tabela === 'projetos') {
      this.tabelas.projeto_gastos = this.tabelas.projeto_gastos.filter(
        (g) => !ids.has(str(g.projeto_id)),
      )
    }
    if (tabela === 'cartoes') {
      this.tabelas.faturas_pagas = this.tabelas.faturas_pagas.filter(
        (f) => !ids.has(str(f.cartao_id)),
      )
    }
    if (tabela === 'categorias') {
      for (const g of this.linhas('gastos', uid))
        if (ids.has(str(g.categoria_id))) g.categoria_id = null
      this.tabelas.aprendizado_categoria = this.tabelas.aprendizado_categoria.filter(
        (a) => !ids.has(str(a.categoria_id)),
      )
    }
  }

  excluirUsuario(uid: string) {
    this.usuarios = this.usuarios.filter((u) => u.id !== uid)
    for (const t of TABELAS) {
      this.tabelas[t] = this.tabelas[t].filter((l) =>
        t === 'profiles' ? l.id !== uid : l.user_id !== uid,
      )
    }
  }

  // RPCs (mesmas regras do SQL) --------------------------------------------------

  totalFatura(uid: string, cartaoId: string, mes: MesRef): number {
    const compras = this.linhas('gastos', uid)
      .filter((g) => g.cartao_id === cartaoId && g.fatura_mes_ref === mes && !g.deleted_at)
      .reduce((s, g) => s + num(g.valor_centavos), 0)
    const dividas = this.linhas('dividas_pagamentos', uid)
      .filter(
        (p) => p.cartao_id === cartaoId && p.fatura_mes_ref === mes && this.dividaAtiva(uid, p),
      )
      .reduce((s, p) => s + num(p.valor_centavos), 0)
    return compras + dividas
  }

  private dividaAtiva(uid: string, pagamento: Linha) {
    return this.linhas('dividas', uid).some((d) => d.id === pagamento.divida_id && !d.deleted_at)
  }

  saldoContas(uid: string, ate = hoje()) {
    return this.linhas('contas', uid).map((c) => {
      const projetos = this.linhas('projetos', uid)
      const saldo = saldoConta(
        {
          saldoInicialCentavos: num(c.saldo_inicial_centavos),
          receitas: this.linhas('receitas', uid)
            .filter((r) => r.conta_id === c.id)
            .map((r) => ({
              valorCentavos: num(r.valor_centavos),
              data: str(r.data),
              excluida: !!r.deleted_at,
            })),
          gastos: this.linhas('gastos', uid)
            .filter((g) => g.conta_id === c.id)
            .map((g) => ({
              valorCentavos: num(g.valor_centavos),
              data: str(g.data),
              origem: g.origem as 'pix',
              excluido: !!g.deleted_at,
            })),
          faturasPagas: this.linhas('faturas_pagas', uid)
            .filter((f) => f.conta_id === c.id)
            .map((f) => ({
              totalCentavos: this.totalFatura(uid, str(f.cartao_id), str(f.mes_ref)),
              pagoEm: str(f.pago_em),
            })),
          pagamentosDividas: this.linhas('dividas_pagamentos', uid)
            .filter((p) => p.conta_id === c.id)
            .map((p) => ({
              valorCentavos: num(p.valor_centavos),
              pagoEm: str(p.pago_em),
              formaPagamento: p.forma_pagamento as 'conta',
              dividaExcluida: !this.dividaAtiva(uid, p),
            })),
          gastosProjetos: this.linhas('projeto_gastos', uid).flatMap((g) => {
            const p = projetos.find((x) => x.id === g.projeto_id)
            if (!p || p.conta_id !== c.id) return []
            return [
              {
                valorCentavos: num(g.valor_centavos),
                data: str(g.data),
                descontarDoSaldo: !!p.descontar_do_saldo,
                excluido: !!g.deleted_at,
                projetoExcluido: !!p.deleted_at,
              },
            ]
          }),
        },
        ate,
      )
      return {
        conta_id: c.id,
        nome: c.nome,
        saldo_inicial_centavos: num(c.saldo_inicial_centavos),
        saldo_centavos: saldo,
      }
    })
  }

  dividasDoMes(uid: string, mes: MesRef) {
    const hojeISO = hoje()
    return this.linhas('dividas', uid)
      .filter((d) => !d.deleted_at)
      .flatMap((d) => {
        const calc = paraCalculo(d)
        const pg = this.linhas('dividas_pagamentos', uid).find(
          (p) => p.divida_id === d.id && p.mes_ref === mes,
        )
        if (!dividaApareceNoMes(calc, mes, !!pg)) return []
        const n = numeroParcelaDivida(calc.parcelasJaPagas, calc.mesInicioRef, mes)
        const venc = vencimentoDivida(calc, mes)
        const total = calc.totalParcelas
        return [
          {
            divida_id: d.id,
            nome: d.nome,
            tipo: d.tipo,
            infinita: calc.infinita,
            forma_pagamento: pg ? pg.forma_pagamento : d.forma_pagamento,
            conta_id: pg ? pg.conta_id : d.conta_id,
            cartao_id: pg ? pg.cartao_id : d.cartao_id,
            dia_vencimento: calc.diaVencimento,
            data_vencimento: venc,
            dias_para_vencer: Math.round((Date.parse(venc) - Date.parse(hojeISO)) / 86_400_000),
            parcela_numero: n,
            total_parcelas: total,
            parcelas_restantes: calc.infinita || total === null ? null : total - n,
            valor_centavos: pg ? num(pg.valor_centavos) : calc.valorParcelaCentavos,
            status: statusDivida(calc, mes, !!pg, hojeISO),
            pagamento_id: pg?.id ?? null,
            pago_em: pg?.pago_em ?? null,
            paga_antes_do_cadastro: !pg && pagaAntesDoCadastro(calc, mes),
            saldo_devedor_centavos:
              calc.infinita || total === null ? null : (total - n) * calc.valorParcelaCentavos,
          },
        ]
      })
      .sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : 1))
  }

  /**
   * Espelha public.limite_cartao: compras não excluídas em faturas não pagas +
   * saldo devedor das contas a pagar neste cartão.
   */
  limiteCartao(uid: string, cartaoId: string) {
    const cartao = this.linhas('cartoes', uid).find((c) => c.id === cartaoId)
    if (!cartao) return null
    const pagas = new Set(
      this.linhas('faturas_pagas', uid)
        .filter((f) => f.cartao_id === cartaoId)
        .map((f) => str(f.mes_ref)),
    )
    const compras = this.linhas('gastos', uid)
      .filter((g) => g.cartao_id === cartaoId)
      .map((g) => ({
        valorCentavos: num(g.valor_centavos),
        faturaMesRef: str(g.fatura_mes_ref),
        excluido: !!g.deleted_at,
      }))
    const pagamentos = this.linhas('dividas_pagamentos', uid)
    const contasAPagar = this.linhas('dividas', uid).map((d) => ({
      ...paraCalculo(d),
      formaPagamento: d.forma_pagamento === 'cartao' ? ('cartao' as const) : ('conta' as const),
      cartaoId: d.cartao_id === null ? null : str(d.cartao_id),
      excluida: !!d.deleted_at,
      mesesPagos: pagamentos.filter((p) => p.divida_id === d.id).map((p) => str(p.mes_ref)),
    }))
    const limite = limiteCartao(
      num(cartao.limite_centavos),
      compras,
      pagas,
      comprometidoPorContasAPagar(cartaoId, contasAPagar, mesAtual()),
    )
    return {
      cartao_id: cartaoId,
      limite_centavos: limite.limiteCentavos,
      usado_centavos: limite.usadoCentavos,
      disponivel_centavos: limite.disponivelCentavos,
      percentual: limite.percentual,
    }
  }

  faturasDoMes(uid: string, mes: MesRef, cartaoId?: string) {
    const hojeISO = hoje()
    return this.linhas('cartoes', uid)
      .filter((c) => (cartaoId ? c.id === cartaoId : !c.arquivado))
      .map((c) => {
        const fechamento = num(c.dia_fechamento)
        const paga = this.linhas('faturas_pagas', uid).find(
          (f) => f.cartao_id === c.id && f.mes_ref === mes,
        )
        const compras = this.linhas('gastos', uid).filter(
          (g) => g.cartao_id === c.id && g.fatura_mes_ref === mes && !g.deleted_at,
        )
        const comprasTotal = compras.reduce((s, g) => s + num(g.valor_centavos), 0)
        const total = this.totalFatura(uid, c.id, mes)
        const limite = this.limiteCartao(uid, c.id)
        const vencimento = vencimentoFatura(mes, fechamento, num(c.dia_vencimento))
        return {
          cartao_id: c.id,
          nome: c.nome,
          cor: c.cor,
          arquivado: c.arquivado,
          mes_ref: mes,
          data_fechamento: fechamentoFatura(mes, fechamento),
          data_vencimento: vencimento,
          dias_para_vencer: Math.round((Date.parse(vencimento) - Date.parse(hojeISO)) / 86_400_000),
          status: statusFatura(mes, fechamento, !!paga, hojeISO),
          compras_centavos: comprasTotal,
          dividas_centavos: total - comprasTotal,
          total_centavos: total,
          qtd_compras: compras.length,
          limite_centavos: limite?.limite_centavos ?? 0,
          limite_usado_centavos: limite?.usado_centavos ?? 0,
          limite_disponivel_centavos: limite?.disponivel_centavos ?? 0,
          limite_percentual: limite?.percentual ?? 0,
          pago_em: paga?.pago_em ?? null,
          conta_pagamento_id: paga?.conta_id ?? null,
        }
      })
  }

  resumoMes(uid: string, mes: MesRef) {
    const dias = diasDoMes(mes, hoje())
    const saldo = this.saldoContas(uid, dias.dataReferencia).reduce(
      (s, c) => s + c.saldo_centavos,
      0,
    )
    const totais = totaisGastosDoMes(
      this.linhas('gastos', uid).map((g) => ({
        valorCentavos: num(g.valor_centavos),
        data: str(g.data),
        tipo: g.tipo as 'necessario',
        excluido: !!g.deleted_at,
      })),
      mes,
    )
    const receitas = this.linhas('receitas', uid)
      .filter(
        (r) => !r.deleted_at && str(r.data) >= primeiroDia(mes) && str(r.data) <= ultimoDia(mes),
      )
      .reduce((s, r) => s + num(r.valor_centavos), 0)
    const perfil = this.linhas('profiles', uid)[0]
    const meta = perfil?.meta_desnecessario_centavos ?? null
    const alerta = alertaDesnecessarios({
      desnecessarioCentavos: totais.desnecessarioCentavos,
      metaCentavos: meta === null ? null : num(meta),
      situacao: dias.situacao,
      diasPassados: dias.diasPassados,
      diasNoMes: dias.diasNoMes,
    })
    const dividas = this.dividasDoMes(uid, mes)
    const soma = (l: { valor_centavos: number }[]) => l.reduce((s, d) => s + d.valor_centavos, 0)
    const pendentes = soma(dividas.filter((d) => d.status !== 'paga'))
    const faturasPendentes = this.linhas('cartoes', uid).reduce((s, c) => {
      const mesFat = faturaQueVenceNoMes(mes, num(c.dia_fechamento), num(c.dia_vencimento))
      const paga = this.linhas('faturas_pagas', uid).some(
        (f) => f.cartao_id === c.id && f.mes_ref === mesFat,
      )
      return paga ? s : s + this.totalFatura(uid, c.id, mesFat)
    }, 0)
    const hojeISO = hoje()
    const lancou = (['gastos', 'receitas', 'projeto_gastos'] as const).some((t) =>
      this.linhas(t, uid).some(
        (l) => !l.deleted_at && (l.data === hojeISO || str(l.created_at).slice(0, 10) === hojeISO),
      ),
    )
    return {
      mes_ref: mes,
      situacao: dias.situacao,
      data_referencia: dias.dataReferencia,
      saldo_total_centavos: saldo,
      gastos_mes_centavos: totais.totalCentavos,
      necessario_centavos: totais.necessarioCentavos,
      desnecessario_centavos: totais.desnecessarioCentavos,
      receitas_mes_centavos: receitas,
      meta_desnecessario_centavos: meta,
      desnecessario_percentual: alerta.percentual,
      desnecessario_projecao_centavos: alerta.projecaoCentavos,
      desnecessario_dias_para_estourar: alerta.diasParaEstourar,
      dividas_total_centavos: soma(dividas),
      dividas_pagas_centavos: soma(dividas.filter((d) => d.status === 'paga')),
      dividas_pendentes_centavos: pendentes,
      saldo_devedor_centavos: dividas.reduce((s, d) => s + (d.saldo_devedor_centavos ?? 0), 0),
      recorrentes_mensal_centavos: soma(dividas.filter((d) => d.infinita)),
      faturas_pendentes_centavos: faturasPendentes,
      sobra_mes_centavos: sobraNoMes(saldo, pendentes, faturasPendentes),
      dias_no_mes: dias.diasNoMes,
      dias_passados: dias.diasPassados,
      dias_restantes: dias.diasRestantes,
      pode_gastar_dia_centavos: podeGastarPorDia(saldo, pendentes, dias.diasRestantes),
      lancou_hoje: lancou,
    }
  }

  // HTTP -----------------------------------------------------------------------

  async instalar(contexto: BrowserContext) {
    await contexto.route(`${URL_SUPABASE}/**`, (route) => this.responder(route))
  }

  private async responder(route: Route) {
    const req = route.request()
    const url = new URL(req.url())
    const corpo = lerCorpo(req)
    this.chamadas.push({ metodo: req.method(), caminho: url.pathname, corpo })
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': '*',
    }
    const enviar = (status: number, dados?: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, 'content-type': 'application/json' },
        body: dados === undefined ? '' : JSON.stringify(dados),
      })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    try {
      if (url.pathname.startsWith('/auth/v1/')) return await this.auth(req, url, corpo, enviar)
      const uid = this.usuarioDoToken(req)
      if (url.pathname === '/functions/v1/excluir-conta') {
        if (!uid) return await enviar(401, { erro: 'Sessão ausente.' })
        this.excluirUsuario(uid)
        return await enviar(200, { ok: true })
      }
      if (!uid) return await enviar(401, { code: 'PGRST301', message: 'JWT ausente' })
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        return await enviar(200, this.rpc(uid, url.pathname.slice('/rest/v1/rpc/'.length), corpo))
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        return await this.rest(uid, req, url, corpo, enviar)
      }
      return await enviar(404, { message: `não simulado: ${url.pathname}` })
    } catch (erro) {
      if (erro instanceof ErroBanco) {
        return enviar(erro.status, {
          code: erro.code,
          message: erro.message,
          details: null,
          hint: null,
        })
      }
      throw erro
    }
  }

  private sessao(usuario: Usuario) {
    const expira = Math.floor(Date.now() / 1000) + 3600
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, exp: expira, role: 'authenticated', aud: 'authenticated', email: usuario.email })}.falso`
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expira,
      refresh_token: `refresh-${usuario.id}`,
      user: this.usuarioAuth(usuario),
    }
  }

  private usuarioAuth(u: Usuario) {
    return {
      id: u.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: u.email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { nome: u.nome },
      identities: [{ id: u.id, provider: 'email' }],
      created_at: new Date().toISOString(),
    }
  }

  private usuarioDoToken(req: Request): string | null {
    const token = req.headers().authorization?.replace(/^Bearer\s+/i, '') ?? ''
    const partes = token.split('.')
    if (partes.length !== 3 || !partes[1]) return null
    try {
      const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString()) as { sub?: string }
      return this.usuarios.some((u) => u.id === carga.sub) ? (carga.sub ?? null) : null
    } catch {
      return null
    }
  }

  private async auth(
    req: Request,
    url: URL,
    corpo: Record<string, unknown>,
    enviar: (status: number, dados?: unknown) => Promise<void>,
  ) {
    const caminho = url.pathname.slice('/auth/v1'.length)
    const email = str(corpo.email as Valor).toLowerCase()
    if (caminho === '/signup') {
      if (this.usuarios.some((u) => u.email === email)) {
        return enviar(422, {
          code: 422,
          error_code: 'user_already_exists',
          msg: 'User already registered',
        })
      }
      const dados = (corpo.data ?? {}) as { nome?: string }
      const u = this.criarUsuario(email, str(corpo.password as Valor), dados.nome ?? '')
      return enviar(200, this.confirmarEmail ? this.usuarioAuth(u) : this.sessao(u))
    }
    if (caminho === '/token') {
      const tipo = url.searchParams.get('grant_type')
      const u =
        tipo === 'refresh_token'
          ? this.usuarios.find((x) => `refresh-${x.id}` === corpo.refresh_token)
          : this.usuarios.find((x) => x.email === email && x.senha === corpo.password)
      if (!u) {
        return enviar(400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        })
      }
      return enviar(200, this.sessao(u))
    }
    if (caminho === '/recover') return enviar(200, {})
    if (caminho === '/logout') return enviar(204)
    const uid = this.usuarioDoToken(req)
    const u = this.usuarios.find((x) => x.id === uid)
    if (caminho === '/user' && u) {
      if (req.method() === 'PUT' && typeof corpo.password === 'string') u.senha = corpo.password
      return enviar(200, this.usuarioAuth(u))
    }
    return enviar(401, { code: 401, error_code: 'session_not_found', msg: 'Sessão ausente' })
  }

  private rpc(uid: string, nome: string, args: Record<string, unknown>) {
    const mes = str(args.p_mes_ref as Valor)
    switch (nome) {
      case 'saldo_contas':
        return this.saldoContas(uid, (args.p_ate as string | undefined) ?? undefined)
      case 'resumo_mes':
        return [this.resumoMes(uid, mes)]
      case 'dividas_do_mes':
        return this.dividasDoMes(uid, mes)
      case 'faturas_do_mes':
        return this.faturasDoMes(uid, mes, (args.p_cartao_id as string | undefined) ?? undefined)
      case 'fatura_cartao':
        return this.faturasDoMes(uid, mes, str(args.p_cartao_id as Valor))
      case 'limite_cartao': {
        const limite = this.limiteCartao(uid, str(args.p_cartao_id as Valor))
        return limite ? [limite] : []
      }
      default:
        throw new ErroBanco('PGRST202', `função não simulada: ${nome}`, 404)
    }
  }

  private async rest(
    uid: string,
    req: Request,
    url: URL,
    corpo: unknown,
    enviar: (status: number, dados?: unknown) => Promise<void>,
  ) {
    const tabela = url.pathname.slice('/rest/v1/'.length) as Tabela
    if (!TABELAS.includes(tabela)) throw new ErroBanco('42P01', `tabela ${tabela}`, 404)
    const prefer = req.headers().prefer ?? ''
    const objeto = (req.headers().accept ?? '').includes('vnd.pgrst.object')
    const devolver = prefer.includes('return=representation')
    const responder = (linhas: Linha[], status = 200) => {
      if (objeto) {
        if (linhas.length !== 1) {
          return enviar(406, {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          })
        }
        return enviar(status, linhas[0])
      }
      return enviar(status, linhas)
    }
    const filtradas = () => aplicarFiltros(this.linhas(tabela, uid), url.searchParams)

    switch (req.method()) {
      case 'GET':
        return responder(ordenarELimitar(filtradas(), url.searchParams))
      case 'POST': {
        let lista = (Array.isArray(corpo) ? corpo : [corpo]) as Record<string, Valor>[]
        // Como o PostgREST: com ?columns= (insert em lote do supabase-js), a coluna
        // que falta num objeto vira NULL, a não ser que venha Prefer: missing=default.
        const colunas = url.searchParams.get('columns')
        if (colunas && !prefer.includes('missing=default')) {
          const nomes = colunas.split(',').map((c) => c.replace(/"/g, ''))
          lista = lista.map((d) => ({
            ...Object.fromEntries(nomes.map((n) => [n, null])),
            ...d,
          }))
        }
        const conflito = prefer.includes('resolution=merge-duplicates')
          ? (url.searchParams.get('on_conflict')?.split(',') ?? ['id'])
          : undefined
        // Um insert é atômico: se uma linha falhar, nenhuma entra.
        const copia = structuredClone(this.tabelas)
        try {
          const inseridas = lista.map((d) => this.inserir(uid, tabela, d, conflito))
          return devolver ? responder(inseridas, 201) : enviar(201)
        } catch (erro) {
          this.tabelas = copia
          throw erro
        }
      }
      case 'PATCH': {
        const alteradas = this.atualizar(uid, tabela, filtradas(), corpo as Record<string, Valor>)
        return devolver ? responder(alteradas) : enviar(204)
      }
      case 'DELETE': {
        const apagadas = filtradas()
        this.apagar(uid, tabela, apagadas)
        return devolver ? responder(apagadas) : enviar(204)
      }
      default:
        throw new ErroBanco('PGRST000', 'método não simulado', 405)
    }
  }
}

function paraCalculo(d: Linha): DividaParaCalculo {
  return {
    infinita: !!d.infinita,
    totalParcelas: d.total_parcelas === null ? null : num(d.total_parcelas),
    parcelasJaPagas: num(d.parcelas_ja_pagas),
    mesInicioRef: str(d.mes_inicio_ref),
    diaVencimento: num(d.dia_vencimento),
    valorParcelaCentavos: num(d.valor_parcela_centavos),
    ativa: !!d.ativa,
  }
}

function lerCorpo(req: Request): Record<string, unknown> {
  const texto = req.postData()
  if (!texto) return {}
  try {
    return JSON.parse(texto) as Record<string, unknown>
  } catch {
    return {}
  }
}

const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

/** Filtros do PostgREST usados pelo app: eq, neq, is, in, gte, lte, gt, lt, like. */
function aplicarFiltros(linhas: Linha[], parametros: URLSearchParams): Linha[] {
  let resultado = linhas
  for (const [coluna, expressao] of parametros) {
    if (RESERVADOS.has(coluna)) continue
    const ponto = expressao.indexOf('.')
    const op = expressao.slice(0, ponto)
    const valor = expressao.slice(ponto + 1)
    resultado = resultado.filter((l) => {
      const atual = l[coluna]
      switch (op) {
        case 'eq':
          return str(atual) === valor
        case 'neq':
          return str(atual) !== valor
        case 'is':
          return valor === 'null' ? atual === null || atual === undefined : str(atual) === valor
        case 'in':
          return valor
            .replace(/^\(|\)$/g, '')
            .split(',')
            .map((v) => v.replace(/^"|"$/g, ''))
            .includes(str(atual))
        case 'gte':
          return str(atual) >= valor
        case 'lte':
          return str(atual) <= valor
        case 'gt':
          return str(atual) > valor
        case 'lt':
          return str(atual) < valor
        case 'like': {
          const re = new RegExp(
            `^${valor.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`,
          )
          return re.test(str(atual))
        }
        default:
          throw new ErroBanco('PGRST100', `filtro não simulado: ${op}`)
      }
    })
  }
  return resultado
}

function ordenarELimitar(linhas: Linha[], parametros: URLSearchParams): Linha[] {
  const ordem = parametros.get('order')
  let resultado = [...linhas]
  if (ordem) {
    const criterios = ordem.split(',').map((c) => {
      const [coluna = '', direcao = 'asc'] = c.split('.')
      return { coluna, desc: direcao === 'desc' }
    })
    resultado.sort((a, b) => {
      for (const { coluna, desc } of criterios) {
        const va = a[coluna]
        const vb = b[coluna]
        if (va === vb) continue
        const menor = typeof va === 'number' && typeof vb === 'number' ? va < vb : str(va) < str(vb)
        return (menor ? -1 : 1) * (desc ? -1 : 1)
      }
      return 0
    })
  }
  const limite = parametros.get('limit')
  if (limite) resultado = resultado.slice(0, Number(limite))
  return resultado
}

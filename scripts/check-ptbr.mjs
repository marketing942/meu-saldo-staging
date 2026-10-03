#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Procura, nos textos que o usuário vê, palavras comuns do português escritas
// sem acento ("voce", "nao", "mes", "dividas"...). Não é um corretor completo:
// é uma rede de segurança para os erros mais frequentes.
//
//   npm run check:ptbr
//
// O que é verificado:
//   * src/**/*.tsx e src/**/*.ts (menos testes e tipos gerados): texto JSX,
//     atributos de texto (rotulo, titulo, placeholder, aria-label...) e strings
//     com cara de frase (com espaço, maiúscula ou acento). Strings de uma palavra
//     só em minúsculas (nomes de tabela, rotas, chaves) ficam de fora.
//   * index.html, README.md, docs/*.md e supabase/README.md (fora de blocos de código).
//
// Para ignorar uma linha de propósito, coloque nela o comentário: ptbr-ignorar
// Sai com código 1 se encontrar algo.
//
//   npm run check:ptbr -- --listar   lista todos os textos de tela encontrados (para revisão)
// -----------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

/**
 * Forma sem acento -> forma correta. Só palavras que não existem sem acento em
 * português (por isso ficam de fora verbos como "valida" e "calculo").
 */
const PALAVRAS = {
  voce: 'você',
  voces: 'vocês',
  nao: 'não',
  ja: 'já',
  mes: 'mês',
  ate: 'até',
  tambem: 'também',
  so: 'só',
  sao: 'são',
  estao: 'estão',
  entao: 'então',
  apos: 'após',
  inicio: 'início',
  divida: 'dívida',
  dividas: 'dívidas',
  descricao: 'descrição',
  descricoes: 'descrições',
  necessario: 'necessário',
  necessarios: 'necessários',
  necessaria: 'necessária',
  desnecessario: 'desnecessário',
  desnecessarios: 'desnecessários',
  lancamento: 'lançamento',
  lancamentos: 'lançamentos',
  lancar: 'lançar',
  lancou: 'lançou',
  lancado: 'lançado',
  lancada: 'lançada',
  lancados: 'lançados',
  excluido: 'excluído',
  excluida: 'excluída',
  excluidos: 'excluídos',
  concluido: 'concluído',
  concluida: 'concluída',
  nivel: 'nível',
  preferencias: 'preferências',
  saida: 'saída',
  saidas: 'saídas',
  agua: 'água',
  grafico: 'gráfico',
  graficos: 'gráficos',
  analise: 'análise',
  experiencia: 'experiência',
  servico: 'serviço',
  servicos: 'serviços',
  configuracao: 'configuração',
  configuracoes: 'configurações',
  usuario: 'usuário',
  usuarios: 'usuários',
  usuaria: 'usuária',
  politica: 'política',
  previsao: 'previsão',
  previsoes: 'previsões',
  cartao: 'cartão',
  cartoes: 'cartões',
  credito: 'crédito',
  debito: 'débito',
  orcamento: 'orçamento',
  numero: 'número',
  proximo: 'próximo',
  proximos: 'próximos',
  proxima: 'próxima',
  proximas: 'próximas',
  ultimo: 'último',
  ultima: 'última',
  ultimos: 'últimos',
  unico: 'único',
  unica: 'única',
  periodo: 'período',
  historico: 'histórico',
  pagina: 'página',
  possivel: 'possível',
  impossivel: 'impossível',
  disponivel: 'disponível',
  invalido: 'inválido',
  invalida: 'inválida',
  conexao: 'conexão',
  sessao: 'sessão',
  versao: 'versão',
  opcao: 'opção',
  opcoes: 'opções',
  situacao: 'situação',
  informacao: 'informação',
  informacoes: 'informações',
  atencao: 'atenção',
  exclusao: 'exclusão',
  confirmacao: 'confirmação',
  recuperacao: 'recuperação',
  notificacao: 'notificação',
  notificacoes: 'notificações',
  alimentacao: 'alimentação',
  educacao: 'educação',
  saude: 'saúde',
  condominio: 'condomínio',
  emprestimo: 'empréstimo',
  emprestimos: 'empréstimos',
  salario: 'salário',
  automatico: 'automático',
  automatica: 'automática',
  minimo: 'mínimo',
  maximo: 'máximo',
  rapido: 'rápido',
  facil: 'fácil',
  diario: 'diário',
  diaria: 'diária',
  codigo: 'código',
  tres: 'três',
  porem: 'porém',
  alem: 'além',
  atras: 'atrás',
}
const ERRADAS = new Map(Object.entries(PALAVRAS))

/** Atributos JSX que viram texto na tela (ou para leitores de tela). */
const ATRIBUTOS_DE_TEXTO = new Set([
  'aria-label',
  'alt',
  'title',
  'placeholder',
  'rotulo',
  'titulo',
  'subtitulo',
  'descricao',
  'legenda',
  'pergunta',
  'rotuloConfirmar',
  'erro',
])

const IGNORAR_PASTAS = new Set(['node_modules', 'dist', 'dist-e2e', 'dev-dist', '.git'])

function arquivos(pasta, extensoes) {
  const lista = []
  for (const nome of readdirSync(pasta)) {
    if (IGNORAR_PASTAS.has(nome)) continue
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) lista.push(...arquivos(caminho, extensoes))
    else if (extensoes.some((ext) => nome.endsWith(ext))) lista.push(caminho)
  }
  return lista
}

/**
 * String que é código, não texto de tela: rota, import, chave, fuso
 * ("America/Sao_Paulo"), classes do Tailwind ou lista de colunas do Supabase.
 * Uma palavra solta com maiúscula ("Início") ou uma frase comum continuam sendo texto.
 */
function pareceCodigo(texto) {
  const pedacos = texto.split(/[\s,]+/).filter(Boolean)
  if (pedacos.length === 0) return true
  if (pedacos.length === 1 && /^[A-Za-z0-9]*$/.test(pedacos[0]))
    return /^[a-z0-9]*$/.test(pedacos[0])
  const tecnico = /[-_:/.[@=]/
  return (
    pedacos.every((p) => /^[A-Za-z0-9_*().:!\[\]/%&>#=@?-]+$/.test(p)) &&
    pedacos.some((p) => tecnico.test(p)) &&
    (pedacos.length === 1 || pedacos.every((p) => !/[A-Z]/.test(p)))
  )
}

/** Trechos de texto visível de um arquivo TS/TSX, com a linha de cada um. */
function textosDoCodigo(caminho) {
  const fonte = readFileSync(caminho, 'utf8')
  const arquivo = ts.createSourceFile(
    caminho,
    fonte,
    ts.ScriptTarget.Latest,
    true,
    caminho.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const textos = []
  const guardar = (no, texto) => {
    const linha = arquivo.getLineAndCharacterOfPosition(no.getStart()).line + 1
    textos.push({ linha, texto })
  }

  function visitar(no) {
    if (ts.isJsxText(no)) {
      const texto = no.getText().trim()
      if (texto) guardar(no, texto)
    } else if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer)) {
      const nome = no.name.getText()
      if (ATRIBUTOS_DE_TEXTO.has(nome)) guardar(no.initializer, no.initializer.text)
      return
    } else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      // Imports, chaves de objeto e comparações com valores internos não são texto de tela.
      const pai = no.parent
      const ehImport =
        ts.isImportDeclaration(pai) ||
        ts.isExportDeclaration(pai) ||
        (ts.isCallExpression(pai) && pai.expression.kind === ts.SyntaxKind.ImportKeyword)
      const ehChave = ts.isPropertyAssignment(pai) && pai.name === no
      const ehTipo = ts.isLiteralTypeNode(pai)
      if (!ehImport && !ehChave && !ehTipo && !pareceCodigo(no.text)) guardar(no, no.text)
    } else if (ts.isTemplateExpression(no)) {
      const partes = [no.head.text, ...no.templateSpans.map((s) => s.literal.text)].join(' ')
      if (!pareceCodigo(partes.trim())) guardar(no, partes)
    }
    ts.forEachChild(no, visitar)
  }
  visitar(arquivo)

  // Linhas marcadas com ptbr-ignorar.
  const ignoradas = new Set(
    fonte
      .split('\n')
      .map((l, i) => (l.includes('ptbr-ignorar') ? i + 1 : 0))
      .filter(Boolean),
  )
  return textos.filter((t) => !ignoradas.has(t.linha))
}

/** Texto de Markdown/HTML fora de blocos de código, código inline e tags. */
function textosDeDocumento(caminho) {
  const linhas = readFileSync(caminho, 'utf8').split('\n')
  const textos = []
  let emBloco = false
  linhas.forEach((linha, i) => {
    if (linha.trim().startsWith('```')) {
      emBloco = !emBloco
      return
    }
    if (emBloco || linha.includes('ptbr-ignorar')) return
    const limpa = linha
      .replace(/`[^`]*`/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\]\([^)]*\)/g, '] ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\b[\w.-]*[/_][\w./-]*\b/g, ' ')
      .replace(/%[A-Z_]+%/g, ' ')
    textos.push({ linha: i + 1, texto: limpa })
  })
  return textos
}

function problemas(texto) {
  const achados = []
  for (const palavra of texto.match(/[A-Za-zÀ-ÿ]+/g) ?? []) {
    const certa = ERRADAS.get(palavra.toLowerCase())
    if (certa) achados.push(`"${palavra}" → "${certa}"`)
  }
  return achados
}

const alvos = [
  ...arquivos(join(RAIZ, 'src'), ['.ts', '.tsx'])
    .filter((c) => !c.endsWith('.test.ts') && !c.endsWith('database.ts'))
    .map((c) => ({ caminho: c, textos: textosDoCodigo(c) })),
  ...[
    'index.html',
    'README.md',
    'supabase/README.md',
    ...readdirSync(join(RAIZ, 'docs'))
      .filter((n) => n.endsWith('.md'))
      .map((n) => `docs/${n}`),
  ]
    .map((c) => join(RAIZ, c))
    .map((c) => ({ caminho: c, textos: textosDeDocumento(c) })),
]

if (process.argv.includes('--listar')) {
  for (const { caminho, textos } of alvos) {
    for (const { linha, texto } of textos) {
      console.log(`${relative(RAIZ, caminho)}:${linha}\t${texto.replace(/\s+/g, ' ').trim()}`)
    }
  }
  process.exit(0)
}

let total = 0
for (const { caminho, textos } of alvos) {
  for (const { linha, texto } of textos) {
    const achados = problemas(texto)
    if (achados.length === 0) continue
    total += achados.length
    console.log(`${relative(RAIZ, caminho)}:${linha}  ${achados.join(', ')}`)
    console.log(`    ${texto.replace(/\s+/g, ' ').trim().slice(0, 140)}`)
  }
}

if (total > 0) {
  console.log(`\n${total} palavra(s) sem acento nos textos da interface.`)
  process.exit(1)
}
console.log(
  `Textos da interface sem as palavras sem acento mais comuns (${alvos.length} arquivos).`,
)

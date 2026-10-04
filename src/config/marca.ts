/**
 * Identidade do app em um só lugar: o título da página, o manifesto do PWA e os
 * textos da interface usam estes valores. Logo e símbolo ficam em public/branding/;
 * favicons e ícones do PWA saem do símbolo com npm run gen:marca.
 */
export const MARCA = {
  nome: 'Meu Saldo',
  nomeCurto: 'Meu Saldo',
  descricao: 'Organize seus gastos, contas a pagar e metas do mês.',
  idioma: 'pt-BR',
  /** E-mail de contato citado nos Termos e na Política de privacidade (preencha antes de produção). */
  emailContato: '',
  /** Cores do fundo, usadas na barra do navegador e na tela de abertura do PWA. */
  corFundoClaro: '#F3F4F6',
  corFundoEscuro: '#111418',
  /**
   * Logo completa (telas de entrar e cadastro) e símbolo isolado (cabeçalho).
   * "escuro" é a mesma imagem com o preto em cor clara, para o tema escuro.
   * largura/altura: tamanho do arquivo, para o navegador reservar o espaço certo.
   */
  logo: {
    claro: '/branding/logo-meu-saldo.png',
    escuro: '/branding/logo-meu-saldo-escuro.png',
    largura: 981,
    altura: 671,
  },
  simbolo: {
    claro: '/branding/simbolo-meu-saldo.png',
    escuro: '/branding/simbolo-meu-saldo-escuro.png',
    largura: 797,
    altura: 827,
  },
} as const

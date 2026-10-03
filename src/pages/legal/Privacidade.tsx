import { MARCA } from '@/config/marca'

import { Contato, Documento } from './Documento'

export default function Privacidade() {
  return (
    <Documento titulo="Política de privacidade" atualizadoEm="03/10/2026">
      <p>
        Esta política explica quais dados o {MARCA.nome} trata, para quê e quais são os seus
        direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
      </p>
      <h2>1. Dados que tratamos</h2>
      <ul>
        <li>Dados de cadastro: nome, e-mail e senha (guardada de forma cifrada).</li>
        <li>
          Dados que você lança: carteiras, gastos, receitas, cartões, faturas, contas a pagar,
          previsão de desnecessários e projetos.
        </li>
        <li>Preferências do app: tema, ocultar valores e lembrete diário.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <p>
        Só para fazer o app funcionar: identificar você, guardar seus lançamentos e calcular saldos,
        totais e alertas. A base legal é a execução do contrato de uso (os termos que você aceitou).
      </p>
      <h2>3. O que não fazemos</h2>
      <ul>
        <li>Não vendemos nem compartilhamos seus dados para publicidade.</li>
        <li>Não usamos rastreadores nem ferramentas de analytics de terceiros.</li>
      </ul>
      <h2>4. Onde os dados ficam</h2>
      <p>
        Os dados ficam no Supabase (banco de dados e autenticação) e o app é servido pela Vercel.
        Cada usuário só acessa os próprios dados, garantido por regras de segurança no banco. Se o
        monitoramento de erros estiver ligado, falhas técnicas são enviadas ao Sentry sem dados
        pessoais.
      </p>
      <h2>5. Por quanto tempo</h2>
      <p>
        Enquanto sua conta existir. Ao excluir a conta em Configurações, todos os seus dados são
        apagados de forma definitiva.
      </p>
      <h2>6. Seus direitos</h2>
      <p>
        Você pode acessar e corrigir seus dados no próprio app, e pedir informações sobre o
        tratamento, a portabilidade ou a exclusão <Contato />.
      </p>
      <h2>7. Mudanças</h2>
      <p>Esta política pode ser atualizada; a data acima mostra a versão em vigor.</p>
    </Documento>
  )
}

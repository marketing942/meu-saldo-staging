import { MARCA } from '@/config/marca'

import { Contato, Documento } from './Documento'

export default function Termos() {
  return (
    <Documento titulo="Termos de uso" atualizadoEm="03/10/2026">
      <p>
        Estes termos explicam as regras de uso do {MARCA.nome}, um app de organização financeira
        pessoal. Ao criar uma conta, você concorda com eles.
      </p>
      <h2>1. O que o app faz</h2>
      <p>
        O {MARCA.nome} ajuda você a registrar gastos, receitas, cartões, dívidas, metas e projetos,
        e calcula totais, saldos e alertas a partir do que você lança. O app não movimenta dinheiro,
        não se conecta ao seu banco e não faz pagamentos.
      </p>
      <h2>2. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em segredo.</li>
        <li>Os dados lançados são informados por você; confira-os antes de tomar decisões.</li>
        <li>É preciso ter 18 anos ou mais, ou autorização de um responsável legal.</li>
      </ul>
      <h2>3. Sem aconselhamento financeiro</h2>
      <p>
        Os números e alertas do app são calculados a partir dos seus lançamentos e servem só como
        apoio à organização. Eles não são recomendação de investimento, crédito ou qualquer
        aconselhamento financeiro.
      </p>
      <h2>4. Uso adequado</h2>
      <p>
        Não use o app para atividades ilegais nem tente acessar dados de outras pessoas. Contas
        usadas assim podem ser suspensas.
      </p>
      <h2>5. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o app no ar, mas ele pode ficar indisponível por manutenção ou
        falhas. Novas versões podem mudar ou remover funções.
      </p>
      <h2>6. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento em Configurações. A exclusão apaga todos os
        seus dados de forma definitiva.
      </p>
      <h2>7. Mudanças e contato</h2>
      <p>
        Estes termos podem ser atualizados; a data acima mostra a versão em vigor. Dúvidas podem ser
        enviadas <Contato />.
      </p>
    </Documento>
  )
}

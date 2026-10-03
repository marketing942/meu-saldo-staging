# Banco de dados (Supabase)

## Migrations

| Arquivo | Conteúdo |
| --- | --- |
| `20261003120000_base.sql` | Tipos enumerados e funções puras de datas, meses, fatura e parcelas |
| `20261003120100_tabelas.sql` | Tabelas, constraints e índices |
| `20261003120200_gatilhos.sql` | Gatilhos de integridade (fatura da compra, retrato do pagamento, recálculo de parcelas) |
| `20261003120300_rls.sql` | RLS em todas as tabelas e permissões |
| `20261003120400_novo_usuario.sql` | `handle_new_user`: perfil, conta "Carteira" e categorias padrão |
| `20261003120500_rpc.sql` | RPCs: `saldo_total`, `saldo_contas`, `resumo_mes`, `dividas_do_mes`, `faturas_do_mes`, `fatura_cartao`, `total_fatura`, `progresso_meta_receita`, `totais_projeto` |

Aplicar em um projeto remoto: `supabase link --project-ref <ref>` e depois `supabase db push`.

## Testes (pgTAP)

- `tests/01_rls.test.sql`: dois usuários. Para cada uma das 13 tabelas, um usuário não consegue ler, alterar, apagar, inserir em nome do outro, transferir linhas para o outro nem apontar para registros do outro. Também confere que as RPCs não vazam dados, que `anon` não acessa nada e que apagar o usuário apaga tudo em cascata.
- `tests/02_regras_financeiras.test.sql`: regras financeiras com a data fixada em 03/10/2026.

Para rodar sem o stack completo do Supabase (precisa de Docker, `psql` e `pg_prove`):

```bash
scripts/db-test.sh
# usar outra versão do Postgres:
SUPABASE_PG_IMAGE=supabase/postgres:15.8.1.085 scripts/db-test.sh
```

Com o Supabase CLI: `supabase start` e depois `supabase test db`.

## Decisões de modelagem

- **Isolamento por chave estrangeira composta.** Toda referência a outro registro do usuário usa `(registro_id, user_id) -> (id, user_id)`. Uma linha não consegue apontar para a conta, o cartão, a categoria, a dívida ou o projeto de outra pessoa, mesmo que o id vaze. Isso funciona junto com o RLS.
- **Fatura = mês em que fecha.** `gastos.fatura_mes_ref` é calculado por gatilho quando a compra é lançada (ou quando a data ou o cartão mudam). Mudar depois o dia de fechamento do cartão não move compras antigas. O vencimento cai no mesmo mês se `dia_vencimento > dia_fechamento`; senão, no mês seguinte.
- **Retrato do pagamento da dívida.** `dividas_pagamentos` guarda valor, forma de pagamento, conta ou cartão e fatura no momento do pagamento, preenchidos pelo gatilho e não pelo cliente. Editar o valor da dívida só afeta as parcelas ainda não pagas, e a dívida paga no cartão entra na fatura do mês do vencimento, sem ser descontada de novo da conta.
- **Parcelas anteriores ao cadastro.** Na dívida parcelada, um mês com `n <= parcelas_ja_pagas` aparece como paga (`paga_antes_do_cadastro`). Editar o total ou as "já pagas" recomeça a contagem no mês atual (gatilho `dividas_preparar`).
- **Saldo por data.** `saldo_total(p_ate)` considera cada movimento a partir da sua data (padrão: hoje). `resumo_mes` usa o fim do mês para meses passados, hoje para o mês atual e a véspera do mês para meses futuros.
- **Sobra no mês** = saldo − dívidas pendentes do mês − faturas que vencem no mês e ainda não foram pagas.
- **Pode gastar por dia** segue a regra 6 ao pé da letra: (saldo − dívidas pendentes do mês) ÷ dias restantes, contando hoje (mínimo 1). Não existe em meses passados.
- **Projetos** guardam `conta_id`. Quando "descontar do saldo" está ligado e a conta não é informada, o gatilho usa a conta principal.
- **`app.hoje`** é um parâmetro de sessão usado só nos testes para fixar a data. Pela API o cliente não consegue alterá-lo.
- **Arredondamentos:** parcelas com o resto na 1ª; "pode gastar por dia" arredonda para baixo; "receber por dia" arredonda para cima.

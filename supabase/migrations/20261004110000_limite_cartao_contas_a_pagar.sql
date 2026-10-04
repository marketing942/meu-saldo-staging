-- =============================================================================
-- Finanças · 09 · Contas a pagar no cartão comprometem o limite pelo saldo devedor
--
-- Antes (08): uma conta a pagar no cartão só ocupava o limite depois que a
-- parcela do mês era marcada como paga (linha em dividas_pagamentos), e só até a
-- fatura em que ela entrou ser paga. Uma dívida de 12 × R$ 100 recém-criada não
-- ocupava nada.
--
-- Agora o limite usado de um cartão é a soma de duas fontes, sem sobreposição:
--   1. Compras (gastos): cada parcela ocupa o limite até a fatura em que entrou
--      ser paga, inclusive as parcelas de meses futuros. (Sem mudança.)
--   2. Contas a pagar no cartão (dividas com forma_pagamento = 'cartao'): ocupam
--      o saldo devedor ainda não quitado:
--        * parcelada: (total − já pagas antes do cadastro − parcelas marcadas como
--          pagas) × valor da parcela. Cada parcela marcada como paga libera o valor
--          dela na hora;
--        * recorrente: não tem saldo além do ciclo; ocupa a parcela do mês atual
--          enquanto ela não for marcada como paga;
--        * encerrada (ativa = false) ou excluída (deleted_at): não ocupa nada.
--      dividas_pagamentos deixa de entrar no limite: a parcela paga já saiu do
--      saldo devedor, então contá-la de novo seria dupla contagem. Na FATURA nada
--      muda: ela continua mostrando só a parcela do ciclo.
--
-- Nada é guardado em coluna: alterar valor, parcelas ou cartão, excluir, desfazer
-- ou pagar muda o resultado na próxima consulta. Só a função muda (mesma
-- assinatura, então as permissões e faturas_do_mes, que a usa, continuam iguais).
-- Não há alteração de tabelas nem de dados.
-- =============================================================================

create or replace function public.limite_cartao(p_cartao_id uuid)
returns table (
  cartao_id uuid,
  limite_centavos bigint,
  usado_centavos bigint,
  disponivel_centavos bigint,
  percentual numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.limite_centavos,
    uso.total,
    c.limite_centavos - uso.total,
    round(uso.total * 100.0 / c.limite_centavos, 2)
  from public.cartoes c
  cross join lateral (
    select (
      -- 1. Compras: parcelas em faturas ainda não pagas.
      coalesce((
        select sum(g.valor_centavos)
        from public.gastos g
        where g.cartao_id = c.id
          and g.deleted_at is null
          and not exists (
            select 1 from public.faturas_pagas f
            where f.cartao_id = c.id and f.mes_ref = g.fatura_mes_ref
          )
      ), 0)
      -- 2. Contas a pagar neste cartão: saldo devedor ainda não quitado.
      + coalesce((
        select sum(
          case
            when d.infinita then
              case
                when (select public.mes_atual()) >= d.mes_inicio_ref
                 and not exists (
                   select 1 from public.dividas_pagamentos p
                   where p.divida_id = d.id and p.mes_ref = (select public.mes_atual())
                 )
                then d.valor_parcela_centavos
                else 0
              end
            else
              greatest(
                d.total_parcelas - d.parcelas_ja_pagas - (
                  -- Parcelas marcadas como pagas (uma por mês) dentro desta contagem.
                  select count(*)
                  from public.dividas_pagamentos p
                  where p.divida_id = d.id
                    and public.numero_parcela_divida(d.parcelas_ja_pagas, d.mes_inicio_ref, p.mes_ref)
                        between d.parcelas_ja_pagas + 1 and d.total_parcelas
                ),
                0
              ) * d.valor_parcela_centavos
          end
        )
        from public.dividas d
        where d.cartao_id = c.id
          and d.forma_pagamento = 'cartao'
          and d.ativa
          and d.deleted_at is null
      ), 0)
    )::bigint as total
  ) uso
  where c.id = p_cartao_id
    and c.user_id = (select auth.uid());
$$;

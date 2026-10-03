-- =============================================================================
-- Finanças · 08 · Limite do cartão por RPC e fim da meta de receita
--
-- * A "Meta de receita" saiu do app: a função progresso_meta_receita e a tabela
--   metas_receita deixam de existir. As receitas continuam iguais.
-- * limite_cartao(cartao_id): limite total, usado, disponível e percentual,
--   calculados na hora a partir dos lançamentos não excluídos e das faturas
--   pagas. O limite usado nunca é guardado numa coluna, para não ficar
--   desatualizado. faturas_do_mes passa a usar a mesma conta.
--
-- Regras do limite usado (padrão):
--   * compra à vista consome o valor total;
--   * compra parcelada consome todas as parcelas ainda não pagas, inclusive as
--     de meses futuros (cada parcela é uma linha em gastos);
--   * conta a pagar paga no cartão consome o valor da parcela do mês, na fatura
--     em que ela entra (dividas_pagamentos.fatura_mes_ref);
--   * fatura marcada como paga devolve ao limite tudo o que estava nela;
--   * lançamento excluído (deleted_at) não conta; desfazer a exclusão volta a contar.
-- =============================================================================

-- Meta de receita --------------------------------------------------------------

drop function public.progresso_meta_receita(text);
drop table public.metas_receita;

-- Limite do cartão -------------------------------------------------------------

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
      + coalesce((
        select sum(p.valor_centavos)
        from public.dividas_pagamentos p
        join public.dividas d on d.id = p.divida_id
        where p.cartao_id = c.id
          and d.deleted_at is null
          and not exists (
            select 1 from public.faturas_pagas f
            where f.cartao_id = c.id and f.mes_ref = p.fatura_mes_ref
          )
      ), 0)
    )::bigint as total
  ) uso
  where c.id = p_cartao_id
    and c.user_id = (select auth.uid());
$$;

revoke all on function public.limite_cartao(uuid) from public, anon;
grant execute on function public.limite_cartao(uuid) to authenticated, service_role;

-- Faturas do mês: o limite vem de limite_cartao ---------------------------------
-- Mesma assinatura da versão anterior: as permissões da função são mantidas.

create or replace function public.faturas_do_mes(p_mes_ref text, p_cartao_id uuid default null)
returns table (
  cartao_id uuid,
  nome text,
  cor text,
  arquivado boolean,
  mes_ref text,
  data_fechamento date,
  data_vencimento date,
  dias_para_vencer int,
  status public.status_fatura,
  compras_centavos bigint,
  dividas_centavos bigint,
  total_centavos bigint,
  qtd_compras int,
  limite_centavos bigint,
  limite_usado_centavos bigint,
  limite_disponivel_centavos bigint,
  limite_percentual numeric,
  pago_em date,
  conta_pagamento_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      p_mes_ref as mes,
      public.primeiro_dia(p_mes_ref) as inicio, -- valida o formato do mês
      public.hoje() as hoje
  ),
  meus_cartoes as (
    select c.*
    from public.cartoes c
    where c.user_id = (select auth.uid())
      and (
        (p_cartao_id is null and not c.arquivado)
        or c.id = p_cartao_id
      )
  )
  select
    c.id,
    c.nome,
    c.cor,
    c.arquivado,
    pr.mes,
    public.fechamento_fatura(pr.mes, c.dia_fechamento),
    public.vencimento_fatura(pr.mes, c.dia_fechamento, c.dia_vencimento),
    public.vencimento_fatura(pr.mes, c.dia_fechamento, c.dia_vencimento) - pr.hoje,
    case
      when fp.id is not null then 'paga'
      when pr.hoje > public.fechamento_fatura(pr.mes, c.dia_fechamento) then 'fechada'
      else 'aberta'
    end::public.status_fatura,
    compras.total,
    dividas.total,
    compras.total + dividas.total,
    compras.qtd,
    lim.limite_centavos,
    lim.usado_centavos,
    lim.disponivel_centavos,
    lim.percentual,
    fp.pago_em,
    fp.conta_id
  from meus_cartoes c
  cross join params pr
  cross join lateral public.limite_cartao(c.id) lim
  left join public.faturas_pagas fp
    on fp.cartao_id = c.id and fp.mes_ref = pr.mes
  cross join lateral (
    select coalesce(sum(g.valor_centavos), 0)::bigint as total, count(*)::int as qtd
    from public.gastos g
    where g.cartao_id = c.id
      and g.fatura_mes_ref = pr.mes
      and g.deleted_at is null
  ) compras
  cross join lateral (
    select coalesce(sum(p.valor_centavos), 0)::bigint as total
    from public.dividas_pagamentos p
    join public.dividas d on d.id = p.divida_id
    where p.cartao_id = c.id
      and p.fatura_mes_ref = pr.mes
      and d.deleted_at is null
  ) dividas
  order by c.created_at, c.id;
$$;

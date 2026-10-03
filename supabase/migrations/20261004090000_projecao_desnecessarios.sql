-- =============================================================================
-- Finanças · 07 · Projeção de desnecessários sem dízimas
--
-- A versão anterior dividia por um "ritmo" com dízima (ex.: 10000 / 3) antes de
-- arredondar, o que em casos raros dava 1 dia a mais que a conta exata. Agora
-- as contas usam inteiros e uma única divisão no fim, igual às funções puras em
-- TypeScript (src/lib/regras/resumo.ts).
-- =============================================================================

create or replace function public.resumo_mes(p_mes_ref text)
returns table (
  mes_ref text,
  situacao public.situacao_mes,
  data_referencia date,
  saldo_total_centavos bigint,
  gastos_mes_centavos bigint,
  necessario_centavos bigint,
  desnecessario_centavos bigint,
  receitas_mes_centavos bigint,
  meta_desnecessario_centavos bigint,
  desnecessario_percentual numeric,
  desnecessario_projecao_centavos bigint,
  desnecessario_dias_para_estourar int,
  dividas_total_centavos bigint,
  dividas_pagas_centavos bigint,
  dividas_pendentes_centavos bigint,
  saldo_devedor_centavos bigint,
  recorrentes_mensal_centavos bigint,
  faturas_pendentes_centavos bigint,
  sobra_mes_centavos bigint,
  dias_no_mes int,
  dias_passados int,
  dias_restantes int,
  pode_gastar_dia_centavos bigint,
  lancou_hoje boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inicio date := public.primeiro_dia(p_mes_ref);
  v_fim date := public.ultimo_dia(p_mes_ref);
  v_hoje date := public.hoje();
  v_mes_atual text := public.mes_atual();
begin
  if v_uid is null then
    return;
  end if;

  mes_ref := p_mes_ref;
  dias_no_mes := public.dias_no_mes(p_mes_ref);

  if p_mes_ref < v_mes_atual then
    situacao := 'passado';
    data_referencia := v_fim;
    dias_passados := dias_no_mes;
    dias_restantes := 0;
  elsif p_mes_ref = v_mes_atual then
    situacao := 'atual';
    data_referencia := v_hoje;
    dias_passados := extract(day from v_hoje)::int;
    dias_restantes := dias_no_mes - dias_passados + 1;
  else
    situacao := 'futuro';
    data_referencia := v_inicio - 1;
    dias_passados := 0;
    dias_restantes := dias_no_mes;
  end if;

  saldo_total_centavos := public.saldo_total(data_referencia);

  -- Gastos do mês pela data da compra (projetos ficam de fora: outra tabela).
  select
    coalesce(sum(g.valor_centavos), 0),
    coalesce(sum(g.valor_centavos) filter (where g.tipo = 'necessario'), 0),
    coalesce(sum(g.valor_centavos) filter (where g.tipo = 'desnecessario'), 0)
  into gastos_mes_centavos, necessario_centavos, desnecessario_centavos
  from public.gastos g
  where g.user_id = v_uid
    and g.deleted_at is null
    and g.data between v_inicio and v_fim;

  select coalesce(sum(r.valor_centavos), 0)
  into receitas_mes_centavos
  from public.receitas r
  where r.user_id = v_uid
    and r.deleted_at is null
    and r.data between v_inicio and v_fim;

  -- Meta de desnecessários (regra 7).
  select p.meta_desnecessario_centavos
  into meta_desnecessario_centavos
  from public.profiles p
  where p.id = v_uid;

  if meta_desnecessario_centavos is not null then
    desnecessario_percentual := round(desnecessario_centavos * 100.0 / meta_desnecessario_centavos, 2);
  end if;

  -- Contas com inteiros primeiro e uma única divisão no fim (sem dízimas), para
  -- dar exatamente o mesmo resultado das funções puras em TypeScript.
  if situacao = 'atual' and desnecessario_centavos > 0 then
    desnecessario_projecao_centavos := round(
      (desnecessario_centavos * dias_no_mes)::numeric / dias_passados
    );
    if meta_desnecessario_centavos is not null
       and desnecessario_centavos < meta_desnecessario_centavos
       and desnecessario_projecao_centavos > meta_desnecessario_centavos then
      desnecessario_dias_para_estourar := greatest(
        1,
        ceil(
          ((meta_desnecessario_centavos - desnecessario_centavos) * dias_passados)::numeric
          / desnecessario_centavos
        )
      )::int;
    end if;
  end if;

  -- Dívidas do mês.
  select
    coalesce(sum(d.valor_centavos), 0),
    coalesce(sum(d.valor_centavos) filter (where d.status = 'paga'), 0),
    coalesce(sum(d.valor_centavos) filter (where d.status <> 'paga'), 0),
    coalesce(sum(d.saldo_devedor_centavos), 0),
    coalesce(sum(d.valor_centavos) filter (where d.infinita), 0)
  into
    dividas_total_centavos,
    dividas_pagas_centavos,
    dividas_pendentes_centavos,
    saldo_devedor_centavos,
    recorrentes_mensal_centavos
  from public.dividas_do_mes(p_mes_ref) d;

  -- Faturas que vencem neste mês e ainda não foram pagas.
  select coalesce(sum(public.total_fatura(c.id, f.mes_fatura)), 0)
  into faturas_pendentes_centavos
  from public.cartoes c
  cross join lateral (
    select case
      when c.dia_vencimento > c.dia_fechamento then p_mes_ref
      else public.mes_add(p_mes_ref, -1)
    end as mes_fatura
  ) f
  where c.user_id = v_uid
    and not exists (
      select 1 from public.faturas_pagas fp
      where fp.cartao_id = c.id and fp.mes_ref = f.mes_fatura
    );

  -- Sobra no mês: saldo menos o que ainda vence no mês (dívidas e faturas).
  sobra_mes_centavos := saldo_total_centavos - dividas_pendentes_centavos - faturas_pendentes_centavos;

  -- Pode gastar por dia (regra 6). Mês que já passou não tem dias restantes.
  if dias_restantes > 0 then
    pode_gastar_dia_centavos := floor(
      (saldo_total_centavos - dividas_pendentes_centavos)::numeric / greatest(dias_restantes, 1)
    );
  end if;

  -- Lembrete diário: houve lançamento com data de hoje ou criado hoje?
  lancou_hoje := exists (
      select 1 from public.gastos g
      where g.user_id = v_uid and g.deleted_at is null
        and (g.data = v_hoje or (g.created_at at time zone 'America/Sao_Paulo')::date = v_hoje)
    )
    or exists (
      select 1 from public.receitas r
      where r.user_id = v_uid and r.deleted_at is null
        and (r.data = v_hoje or (r.created_at at time zone 'America/Sao_Paulo')::date = v_hoje)
    )
    or exists (
      select 1 from public.projeto_gastos pg
      where pg.user_id = v_uid and pg.deleted_at is null
        and (pg.data = v_hoje or (pg.created_at at time zone 'America/Sao_Paulo')::date = v_hoje)
    );

  return next;
end;
$$;

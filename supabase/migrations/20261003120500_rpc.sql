-- =============================================================================
-- Finanças · 06 · Funções RPC (security invoker)
--
-- Todas rodam com os privilégios de quem chama: o RLS continua valendo e cada
-- usuário só enxerga os próprios dados. Também filtram por auth.uid()
-- explicitamente (usa os índices e não devolve nada para quem não tem login).
--
-- Regras financeiras (espelhadas em funções puras TypeScript, com os mesmos testes):
--  1. Saldo da conta = saldo inicial + receitas − gastos Pix/dinheiro − faturas pagas
--     − dívidas pagas na conta − gastos de projetos com "descontar do saldo".
--     Cada movimento conta a partir da sua data (data, ou pago_em para pagamentos).
--  2. Gastos do mês usam a data da compra (cada parcela no mês em que cai).
--     Gasto no cartão só sai da conta quando a fatura é paga.
--  4. Dívida paga no cartão entra na fatura e não é descontada de novo como dívida.
--  6. Pode gastar por dia = (saldo disponível − dívidas pendentes do mês)
--     ÷ dias restantes do mês (mínimo 1).
--  9. Projetos nunca entram nos totais do mês nem na meta de desnecessários.
-- =============================================================================

-- Total de uma fatura: compras + dívidas pagas no cartão naquela fatura -------

create or replace function public.total_fatura(p_cartao_id uuid, p_mes_ref text)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select (
    coalesce((
      select sum(g.valor_centavos)
      from public.gastos g
      where g.user_id = (select auth.uid())
        and g.cartao_id = p_cartao_id
        and g.fatura_mes_ref = p_mes_ref
        and g.deleted_at is null
    ), 0)
    + coalesce((
      select sum(p.valor_centavos)
      from public.dividas_pagamentos p
      join public.dividas d on d.id = p.divida_id
      where p.user_id = (select auth.uid())
        and p.cartao_id = p_cartao_id
        and p.fatura_mes_ref = p_mes_ref
        and d.deleted_at is null
    ), 0)
  )::bigint;
$$;

-- Saldo por conta (regra 1) --------------------------------------------------
-- p_ate: considera movimentos até essa data (padrão: hoje).

create or replace function public.saldo_contas(p_ate date default null)
returns table (
  conta_id uuid,
  nome text,
  saldo_inicial_centavos bigint,
  saldo_centavos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select coalesce(p_ate, public.hoje()) as ate
  )
  select
    c.id,
    c.nome,
    c.saldo_inicial_centavos,
    (
      c.saldo_inicial_centavos
      + coalesce((
          select sum(r.valor_centavos)
          from public.receitas r
          where r.conta_id = c.id
            and r.deleted_at is null
            and r.data <= params.ate
        ), 0)
      - coalesce((
          select sum(g.valor_centavos)
          from public.gastos g
          where g.conta_id = c.id
            and g.origem <> 'cartao'
            and g.deleted_at is null
            and g.data <= params.ate
        ), 0)
      - coalesce((
          select sum(public.total_fatura(fp.cartao_id, fp.mes_ref))
          from public.faturas_pagas fp
          where fp.conta_id = c.id
            and fp.pago_em <= params.ate
        ), 0)
      - coalesce((
          select sum(p.valor_centavos)
          from public.dividas_pagamentos p
          join public.dividas d on d.id = p.divida_id
          where p.conta_id = c.id
            and p.forma_pagamento = 'conta'
            and d.deleted_at is null
            and p.pago_em <= params.ate
        ), 0)
      - coalesce((
          select sum(pg.valor_centavos)
          from public.projeto_gastos pg
          join public.projetos pj on pj.id = pg.projeto_id
          where pj.conta_id = c.id
            and pj.descontar_do_saldo
            and pj.deleted_at is null
            and pg.deleted_at is null
            and pg.data <= params.ate
        ), 0)
    )::bigint
  from public.contas c
  cross join params
  where c.user_id = (select auth.uid())
  order by c.created_at, c.id;
$$;

-- Saldo total = soma dos saldos das contas -----------------------------------

create or replace function public.saldo_total(p_ate date default null)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(s.saldo_centavos), 0)::bigint
  from public.saldo_contas(p_ate) s;
$$;

-- Faturas dos cartões no mês (regra 3) ---------------------------------------
-- Uma linha por cartão (não arquivado), com a fatura que fecha em p_mes_ref.
-- Com p_cartao_id, devolve só aquele cartão (mesmo arquivado).
-- Limite usado = tudo que está em faturas ainda não pagas (inclui parcelas futuras).

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
    c.limite_centavos,
    uso.total,
    c.limite_centavos - uso.total,
    round(uso.total * 100.0 / c.limite_centavos, 2),
    fp.pago_em,
    fp.conta_id
  from meus_cartoes c
  cross join params pr
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
  order by c.created_at, c.id;
$$;

-- Fatura de um cartão em um mês (tela do cartão).
create or replace function public.fatura_cartao(p_cartao_id uuid, p_mes_ref text)
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
  select * from public.faturas_do_mes(p_mes_ref, p_cartao_id);
$$;

-- Dívidas do mês (regra 5) ---------------------------------------------------
-- Parcelada aparece se 1 <= n <= total; recorrente, em todo mês desde o início.
-- Parcelas com n <= parcelas_ja_pagas foram pagas antes do cadastro.
-- Saldo devedor (após este mês) = (total − n) × valor da parcela.
-- Dívida desativada (ativa = false) só aparece nos meses em que foi paga.

create or replace function public.dividas_do_mes(p_mes_ref text)
returns table (
  divida_id uuid,
  nome text,
  tipo public.tipo_divida,
  infinita boolean,
  forma_pagamento public.forma_pagamento,
  conta_id uuid,
  cartao_id uuid,
  dia_vencimento int,
  data_vencimento date,
  dias_para_vencer int,
  parcela_numero int,
  total_parcelas int,
  parcelas_restantes int,
  valor_centavos bigint,
  status public.status_divida,
  pagamento_id uuid,
  pago_em date,
  paga_antes_do_cadastro boolean,
  saldo_devedor_centavos bigint
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
  base as (
    select
      d.*,
      public.numero_parcela_divida(d.parcelas_ja_pagas, d.mes_inicio_ref, pr.mes) as n,
      public.data_no_mes(pr.mes, d.dia_vencimento) as vencimento,
      pr.hoje,
      pg.id as pagamento_id,
      pg.pago_em,
      pg.valor_centavos as pago_valor,
      pg.forma_pagamento as pago_forma,
      pg.conta_id as pago_conta_id,
      pg.cartao_id as pago_cartao_id
    from public.dividas d
    cross join params pr
    left join public.dividas_pagamentos pg
      on pg.divida_id = d.id and pg.mes_ref = pr.mes
    where d.user_id = (select auth.uid())
      and d.deleted_at is null
  )
  select
    b.id,
    b.nome,
    b.tipo,
    b.infinita,
    coalesce(b.pago_forma, b.forma_pagamento),
    case when b.pagamento_id is not null then b.pago_conta_id else b.conta_id end,
    case when b.pagamento_id is not null then b.pago_cartao_id else b.cartao_id end,
    b.dia_vencimento,
    b.vencimento,
    b.vencimento - b.hoje,
    b.n,
    b.total_parcelas,
    case when b.infinita then null else b.total_parcelas - b.n end,
    coalesce(b.pago_valor, b.valor_parcela_centavos),
    case
      when b.pagamento_id is not null then 'paga'
      when not b.infinita and b.n <= b.parcelas_ja_pagas then 'paga'
      when b.vencimento < b.hoje then 'atrasada'
      else 'pendente'
    end::public.status_divida,
    b.pagamento_id,
    b.pago_em,
    (b.pagamento_id is null and not b.infinita and b.n <= b.parcelas_ja_pagas),
    case
      when b.infinita then null
      else ((b.total_parcelas - b.n)::bigint * b.valor_parcela_centavos)
    end
  from base b
  where (b.ativa or b.pagamento_id is not null)
    and case
      when b.infinita then (select mes from params) >= b.mes_inicio_ref
      else b.n between 1 and b.total_parcelas
    end
  order by b.vencimento, b.nome, b.id;
$$;

-- Resumo do mês (tela Início) ------------------------------------------------

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
  v_ritmo numeric;
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

  if situacao = 'atual' and desnecessario_centavos > 0 then
    v_ritmo := desnecessario_centavos::numeric / dias_passados;
    desnecessario_projecao_centavos := round(v_ritmo * dias_no_mes);
    if meta_desnecessario_centavos is not null
       and desnecessario_centavos < meta_desnecessario_centavos
       and desnecessario_projecao_centavos > meta_desnecessario_centavos then
      desnecessario_dias_para_estourar := greatest(
        1,
        ceil((meta_desnecessario_centavos - desnecessario_centavos) / v_ritmo)
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

-- Meta de receita do mês (regra 8) -------------------------------------------

create or replace function public.progresso_meta_receita(p_mes_ref text)
returns table (
  mes_ref text,
  meta_centavos bigint,
  meta_mes_anterior_centavos bigint,
  recebido_centavos bigint,
  percentual numeric,
  falta_centavos bigint,
  batida boolean,
  dias_restantes int,
  por_dia_centavos bigint
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
begin
  if v_uid is null then
    return;
  end if;

  mes_ref := p_mes_ref;

  select m.valor_meta_centavos into meta_centavos
  from public.metas_receita m
  where m.user_id = v_uid and m.mes_ref = p_mes_ref;

  select m.valor_meta_centavos into meta_mes_anterior_centavos
  from public.metas_receita m
  where m.user_id = v_uid and m.mes_ref = public.mes_add(p_mes_ref, -1);

  select coalesce(sum(r.valor_centavos), 0) into recebido_centavos
  from public.receitas r
  where r.user_id = v_uid
    and r.deleted_at is null
    and r.data between v_inicio and v_fim;

  if meta_centavos is not null then
    percentual := round(recebido_centavos * 100.0 / meta_centavos, 2);
    falta_centavos := greatest(meta_centavos - recebido_centavos, 0);
    batida := recebido_centavos >= meta_centavos;
  else
    batida := false;
  end if;

  if p_mes_ref = public.mes_atual() then
    dias_restantes := public.dias_no_mes(p_mes_ref) - extract(day from v_hoje)::int + 1;
    if falta_centavos > 0 then
      por_dia_centavos := ceil(falta_centavos::numeric / dias_restantes);
    end if;
  end if;

  return next;
end;
$$;

-- Totais de um projeto (regra 9) ---------------------------------------------

create or replace function public.totais_projeto(p_projeto_id uuid)
returns table (
  projeto_id uuid,
  nome text,
  orcamento_centavos bigint,
  descontar_do_saldo boolean,
  arquivado boolean,
  total_centavos bigint,
  qtd_gastos int,
  percentual numeric,
  restante_centavos bigint,
  excedente_centavos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    pj.id,
    pj.nome,
    pj.orcamento_centavos,
    pj.descontar_do_saldo,
    pj.arquivado,
    t.total,
    t.qtd,
    case when pj.orcamento_centavos is not null
      then round(t.total * 100.0 / pj.orcamento_centavos, 2) end,
    case when pj.orcamento_centavos is not null
      then greatest(pj.orcamento_centavos - t.total, 0) end,
    case when pj.orcamento_centavos is not null
      then greatest(t.total - pj.orcamento_centavos, 0) end
  from public.projetos pj
  cross join lateral (
    select coalesce(sum(g.valor_centavos), 0)::bigint as total, count(*)::int as qtd
    from public.projeto_gastos g
    where g.projeto_id = pj.id and g.deleted_at is null
  ) t
  where pj.id = p_projeto_id
    and pj.user_id = (select auth.uid())
    and pj.deleted_at is null;
$$;

-- Permissões das funções -----------------------------------------------------
-- Por padrão o Postgres dá EXECUTE a PUBLIC; aqui só `authenticated` (e o
-- service_role) podem chamar. Funções de gatilho não são chamáveis pela API.
-- A lista é fechada: só as funções criadas por estas migrations são alteradas.
-- Funções que já existiam no schema (ex.: rls_auto_enable, do Supabase) ficam
-- como estão. Se alguma assinatura não existir, o cast para regprocedure falha
-- e a migration é abortada, em vez de pular a função em silêncio.

do $$
declare
  f regprocedure;
begin
  -- Funções chamáveis (01 e 06).
  foreach f in array array[
    'public.hoje()',
    'public.mes_de(date)',
    'public.mes_atual()',
    'public.primeiro_dia(text)',
    'public.ultimo_dia(text)',
    'public.dias_no_mes(text)',
    'public.mes_add(text, integer)',
    'public.mes_diff(text, text)',
    'public.data_no_mes(text, integer)',
    'public.mes_fatura(date, integer)',
    'public.fechamento_fatura(text, integer)',
    'public.vencimento_fatura(text, integer, integer)',
    'public.gerar_parcelas(bigint, date, integer)',
    'public.numero_parcela_divida(integer, text, text)',
    'public.total_fatura(uuid, text)',
    'public.saldo_contas(date)',
    'public.saldo_total(date)',
    'public.faturas_do_mes(text, uuid)',
    'public.fatura_cartao(uuid, text)',
    'public.dividas_do_mes(text)',
    'public.resumo_mes(text)',
    'public.progresso_meta_receita(text)',
    'public.totais_projeto(uuid)'
  ]::regprocedure[]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;

  -- Funções de gatilho (01, 03 e 05).
  foreach f in array array[
    'public.definir_updated_at()',
    'public.gastos_preparar()',
    'public.dividas_preparar()',
    'public.dividas_pagamentos_preparar()',
    'public.projetos_preparar()',
    'public.aprendizado_categoria_preparar()',
    'public.handle_new_user()'
  ]::regprocedure[]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

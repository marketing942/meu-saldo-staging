-- =============================================================================
-- Finanças · 03 · Gatilhos de integridade
--
-- Os gatilhos rodam com os privilégios de quem faz a operação (security
-- invoker): as consultas que fazem também passam pelo RLS. Se um usuário
-- tentar apontar para o cartão ou a dívida de outra pessoa, o registro não é
-- encontrado e a operação falha com 23503 (violação de chave estrangeira).
-- =============================================================================

-- updated_at -------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'contas', 'categorias', 'cartoes', 'gastos', 'receitas', 'dividas',
    'metas_receita', 'projetos', 'projeto_gastos', 'aprendizado_categoria'
  ]
  loop
    execute format(
      'create trigger definir_updated_at before update on public.%I
         for each row execute function public.definir_updated_at()',
      t
    );
  end loop;
end;
$$;

-- Gastos: fatura do cartão ----------------------------------------------------
-- Calcula fatura_mes_ref a partir da data da compra e do dia de fechamento do
-- cartão. Só recalcula quando data, cartão ou origem mudam: alterar depois o dia
-- de fechamento do cartão não move compras antigas de fatura.

create or replace function public.gastos_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dia_fechamento int;
begin
  if new.origem <> 'cartao' then
    new.fatura_mes_ref := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.data = old.data
     and new.cartao_id is not distinct from old.cartao_id
     and new.origem = old.origem
     and old.fatura_mes_ref is not null then
    new.fatura_mes_ref := old.fatura_mes_ref;
    return new;
  end if;

  select c.dia_fechamento into v_dia_fechamento
  from public.cartoes c
  where c.id = new.cartao_id and c.user_id = new.user_id;

  if not found then
    raise exception 'Cartão não encontrado.' using errcode = '23503';
  end if;

  new.fatura_mes_ref := public.mes_fatura(new.data, v_dia_fechamento);
  return new;
end;
$$;

create trigger gastos_preparar
  before insert or update on public.gastos
  for each row execute function public.gastos_preparar();

-- Dívidas: recálculo ao editar parcelas -----------------------------------------
-- Ao editar o total de parcelas ou as "já pagas", a contagem recomeça no mês
-- atual (mes_inicio_ref = mês atual).

create or replace function public.dividas_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.total_parcelas is distinct from old.total_parcelas
       or new.parcelas_ja_pagas is distinct from old.parcelas_ja_pagas
       or new.infinita is distinct from old.infinita
     ) then
    new.mes_inicio_ref := public.mes_atual();
  end if;
  return new;
end;
$$;

create trigger dividas_preparar
  before update on public.dividas
  for each row execute function public.dividas_preparar();

-- Pagamentos de dívidas: validação e retrato ---------------------------------

create or replace function public.dividas_pagamentos_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_divida public.dividas%rowtype;
  v_n int;
  v_dia_fechamento int;
begin
  -- Em atualizações que não mudam dívida nem mês, o retrato não pode ser alterado.
  if tg_op = 'UPDATE'
     and new.divida_id = old.divida_id
     and new.mes_ref = old.mes_ref then
    new.valor_centavos := old.valor_centavos;
    new.forma_pagamento := old.forma_pagamento;
    new.conta_id := old.conta_id;
    new.cartao_id := old.cartao_id;
    new.fatura_mes_ref := old.fatura_mes_ref;
    return new;
  end if;

  select d.* into v_divida
  from public.dividas d
  where d.id = new.divida_id and d.user_id = new.user_id and d.deleted_at is null;

  if not found then
    raise exception 'Dívida não encontrada.' using errcode = '23503';
  end if;

  v_n := public.numero_parcela_divida(v_divida.parcelas_ja_pagas, v_divida.mes_inicio_ref, new.mes_ref);

  if v_divida.infinita then
    if new.mes_ref < v_divida.mes_inicio_ref then
      raise exception 'Esta dívida ainda não existia nesse mês.' using errcode = '22023';
    end if;
  elsif v_n <= v_divida.parcelas_ja_pagas or v_n > v_divida.total_parcelas then
    raise exception 'Não há parcela desta dívida para pagar nesse mês.' using errcode = '22023';
  end if;

  new.valor_centavos := v_divida.valor_parcela_centavos;
  new.forma_pagamento := v_divida.forma_pagamento;
  new.conta_id := v_divida.conta_id;
  new.cartao_id := v_divida.cartao_id;
  new.fatura_mes_ref := null;

  if v_divida.forma_pagamento = 'cartao' then
    select c.dia_fechamento into v_dia_fechamento
    from public.cartoes c
    where c.id = v_divida.cartao_id and c.user_id = new.user_id;

    if not found then
      raise exception 'Cartão não encontrado.' using errcode = '23503';
    end if;

    -- A cobrança cai no cartão na data de vencimento da dívida naquele mês.
    new.fatura_mes_ref := public.mes_fatura(
      public.data_no_mes(new.mes_ref, v_divida.dia_vencimento),
      v_dia_fechamento
    );
  end if;

  return new;
end;
$$;

create trigger dividas_pagamentos_preparar
  before insert or update on public.dividas_pagamentos
  for each row execute function public.dividas_pagamentos_preparar();

-- Projetos: conta padrão para "descontar do saldo" ---------------------------

create or replace function public.projetos_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.descontar_do_saldo and new.conta_id is null then
    select c.id into new.conta_id
    from public.contas c
    where c.user_id = new.user_id
    order by c.created_at, c.id
    limit 1;
  end if;
  return new;
end;
$$;

create trigger projetos_preparar
  before insert or update on public.projetos
  for each row execute function public.projetos_preparar();

-- Aprendizado de categoria: normaliza o termo -----------------------------------

create or replace function public.aprendizado_categoria_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.termo := lower(btrim(regexp_replace(new.termo, '\s+', ' ', 'g')));
  return new;
end;
$$;

create trigger aprendizado_categoria_preparar
  before insert or update on public.aprendizado_categoria
  for each row execute function public.aprendizado_categoria_preparar();

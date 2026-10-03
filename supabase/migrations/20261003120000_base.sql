-- =============================================================================
-- Finanças · 01 · Base: tipos e funções puras de datas e meses
--
-- Convenções do projeto
--   * Valores monetários sempre em centavos (bigint).
--   * Datas como `date` (sem fuso). Meses como texto 'YYYY-MM'.
--   * "Hoje" é sempre calculado no fuso America/Sao_Paulo.
--   * Estas funções são espelhadas por funções puras em TypeScript (src/lib)
--     e as duas implementações precisam devolver os mesmos resultados.
-- =============================================================================

-- Tipos enumerados ------------------------------------------------------------

create type public.tema_preferencia as enum ('sistema', 'claro', 'escuro');
create type public.origem_gasto as enum ('cartao', 'pix', 'dinheiro');
create type public.tipo_gasto as enum ('necessario', 'desnecessario');
create type public.tipo_divida as enum (
  'financiamento', 'emprestimo', 'assinatura', 'aluguel', 'condominio', 'outro'
);
create type public.forma_pagamento as enum ('conta', 'cartao');
create type public.status_fatura as enum ('aberta', 'fechada', 'paga');
create type public.status_divida as enum ('paga', 'pendente', 'atrasada');
create type public.situacao_mes as enum ('passado', 'atual', 'futuro');

-- Hoje e mês atual (America/Sao_Paulo) ----------------------------------------

-- O ajuste `app.hoje` existe só para testes automatizados (permite fixar a data).
-- Pela API (PostgREST) o cliente não consegue alterar parâmetros de sessão.
create or replace function public.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.hoje', true), '')::date,
    (now() at time zone 'America/Sao_Paulo')::date
  );
$$;

create or replace function public.mes_de(p_data date)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_char(p_data, 'YYYY-MM');
$$;

create or replace function public.mes_atual()
returns text
language sql
stable
set search_path = ''
as $$
  select public.mes_de(public.hoje());
$$;

-- Meses 'YYYY-MM' ------------------------------------------------------------

-- Primeiro dia do mês. Valida o formato e falha com mensagem clara (22007).
create or replace function public.primeiro_dia(p_mes text)
returns date
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
begin
  if p_mes is null then
    return null;
  end if;
  if p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mês inválido: "%". Use o formato AAAA-MM.', p_mes
      using errcode = '22007';
  end if;
  return make_date(substr(p_mes, 1, 4)::int, substr(p_mes, 6, 2)::int, 1);
end;
$$;

create or replace function public.ultimo_dia(p_mes text)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (public.primeiro_dia(p_mes) + interval '1 month' - interval '1 day')::date;
$$;

create or replace function public.dias_no_mes(p_mes text)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extract(day from public.ultimo_dia(p_mes))::int;
$$;

-- Soma (ou subtrai, com n negativo) meses: mes_add('2026-12', 1) = '2027-01'.
create or replace function public.mes_add(p_mes text, p_n int)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_char(public.primeiro_dia(p_mes) + make_interval(months => p_n), 'YYYY-MM');
$$;

-- Quantidade de meses de p_de até p_ate: mes_diff('2026-11', '2027-02') = 3.
create or replace function public.mes_diff(p_de text, p_ate text)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (extract(year from public.primeiro_dia(p_ate))::int * 12
          + extract(month from public.primeiro_dia(p_ate))::int)
       - (extract(year from public.primeiro_dia(p_de))::int * 12
          + extract(month from public.primeiro_dia(p_de))::int);
$$;

-- Data do dia `p_dia` no mês, ajustando para o último dia em meses curtos:
-- data_no_mes('2027-02', 31) = 2027-02-28.
create or replace function public.data_no_mes(p_mes text, p_dia int)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.primeiro_dia(p_mes)
       + (least(greatest(p_dia, 1), public.dias_no_mes(p_mes)) - 1);
$$;

-- Cartão de crédito ----------------------------------------------------------
-- A fatura é identificada pelo mês em que FECHA (mes_ref).
-- Compra até o dia de fechamento (inclusive) entra na fatura que fecha no mês
-- da compra; depois do fechamento, entra na fatura do mês seguinte.

create or replace function public.mes_fatura(p_data date, p_dia_fechamento int)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_data <= public.data_no_mes(public.mes_de(p_data), p_dia_fechamento)
      then public.mes_de(p_data)
    else public.mes_add(public.mes_de(p_data), 1)
  end;
$$;

create or replace function public.fechamento_fatura(p_mes text, p_dia_fechamento int)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.data_no_mes(p_mes, p_dia_fechamento);
$$;

-- Se o vencimento é depois do fechamento, vence no mesmo mês; senão, no seguinte.
create or replace function public.vencimento_fatura(
  p_mes text,
  p_dia_fechamento int,
  p_dia_vencimento int
)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_dia_vencimento > p_dia_fechamento then public.data_no_mes(p_mes, p_dia_vencimento)
    else public.data_no_mes(public.mes_add(p_mes, 1), p_dia_vencimento)
  end;
$$;

-- Parcelas de uma compra: uma por mês, mantendo o dia (ajustado em meses curtos).
-- O resto da divisão fica na primeira parcela: 100,00 em 3x = 33,34 + 33,33 + 33,33.
create or replace function public.gerar_parcelas(
  p_valor_total_centavos bigint,
  p_data date,
  p_total_parcelas int
)
returns table (parcela int, data date, valor_centavos bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_mes text := public.mes_de(p_data);
  v_dia int := extract(day from p_data)::int;
  v_base bigint;
  v_resto bigint;
begin
  if p_total_parcelas is null or p_total_parcelas < 1 or p_total_parcelas > 12 then
    raise exception 'O número de parcelas deve ser de 1 a 12.' using errcode = '22023';
  end if;
  if p_valor_total_centavos is null or p_valor_total_centavos < p_total_parcelas then
    raise exception 'Valor insuficiente para % parcelas.', p_total_parcelas
      using errcode = '22023';
  end if;

  v_base := p_valor_total_centavos / p_total_parcelas;
  v_resto := p_valor_total_centavos % p_total_parcelas;

  for i in 1..p_total_parcelas loop
    parcela := i;
    data := public.data_no_mes(public.mes_add(v_mes, i - 1), v_dia);
    valor_centavos := v_base + case when i = 1 then v_resto else 0 end;
    return next;
  end loop;
end;
$$;

-- Dívidas --------------------------------------------------------------------
-- Número da parcela no mês M = parcelas_ja_pagas + meses entre mes_inicio_ref e M + 1.
create or replace function public.numero_parcela_divida(
  p_parcelas_ja_pagas int,
  p_mes_inicio_ref text,
  p_mes_ref text
)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_parcelas_ja_pagas + public.mes_diff(p_mes_inicio_ref, p_mes_ref) + 1;
$$;

-- Gatilho genérico de updated_at -----------------------------------------------

create or replace function public.definir_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

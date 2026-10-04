-- =============================================================================
-- Regras financeiras nas funções SQL e integridade dos dados.
-- "Hoje" fixado em 03/10/2026 (app.hoje) para os resultados serem estáveis.
--
-- Cenário da usuária Carla (valores em centavos):
--   Carteira: saldo inicial 500000. Previsão de desnecessários: 100000.
--   Cartão: limite 200000, fecha dia 10, vence dia 20.
--   Receita 50000 em 01/10.
--   Gastos: Pix 10000 (03/10, necessário) · dinheiro 75000 (01/10, desnecessário)
--           cartão 30000 em 3x a partir de 05/10 · cartão 5000 em 11/10
--           Pix 1000 em 20/10 (futuro) · Pix 7777 excluído.
--   Dívidas: Financiamento (conta, 20000, dia 15, 12x, 5 já pagas, início 2026-08)
--            Streaming (cartão, 5000, dia 1, recorrente)
--            Aluguel (conta, 30000, dia 2, recorrente)
--   Projetos: Viagem (desconta do saldo, orçamento 2500, gasto 3000)
--             Festa (não desconta, gasto 99900)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(91);

-- Auxiliares ------------------------------------------------------------------

create schema tests;
grant usage on schema tests to authenticated;

create function tests.estado(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'carla@teste.local', '',
        '{"provider":"email","providers":["email"]}', '{"nome":"Carla"}', now(), now());

select set_config('app.hoje', '2026-10-03', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- -----------------------------------------------------------------------------
-- Funções puras de datas, fatura e parcelas
-- -----------------------------------------------------------------------------

select is(public.hoje(), '2026-10-03'::date, 'hoje() respeita a data fixada nos testes');
select is(public.mes_fatura('2026-10-10', 10), '2026-10', 'compra no dia do fechamento entra na fatura do mês');
select is(public.mes_fatura('2026-10-11', 10), '2026-11', 'compra depois do fechamento vai para a fatura seguinte');
select is(public.mes_fatura('2026-12-15', 10), '2027-01', 'fatura seguinte vira o ano');
select is(public.mes_fatura('2027-02-28', 31), '2027-02', 'fechamento dia 31 em fevereiro fecha no último dia');
select is(public.vencimento_fatura('2026-10', 25, 5), '2026-11-05'::date, 'vencimento antes do fechamento cai no mês seguinte');
select is(public.vencimento_fatura('2026-10', 3, 10), '2026-10-10'::date, 'vencimento depois do fechamento cai no mesmo mês');
select is(public.data_no_mes('2027-02', 31), '2027-02-28'::date, 'dia 31 em fevereiro vira 28');
select is(public.data_no_mes('2028-02', 30), '2028-02-29'::date, 'ano bissexto: dia 30 em fevereiro vira 29');
select is(public.mes_add('2026-12', 1), '2027-01', 'mes_add vira o ano');
select is(public.mes_add('2026-01', -1), '2025-12', 'mes_add volta o ano');
select is(public.mes_diff('2026-11', '2027-02'), 3, 'mes_diff conta meses entre anos');
select throws_ok($$select public.primeiro_dia('2026-13')$$, '22007', null, 'mês inválido é rejeitado');

select results_eq(
  $$select parcela, data, valor_centavos from public.gerar_parcelas(10000, '2026-10-31', 3)$$,
  $$values (1, '2026-10-31'::date, 3334::bigint),
           (2, '2026-11-30'::date, 3333::bigint),
           (3, '2026-12-31'::date, 3333::bigint)$$,
  'parcelas: uma por mês, dia ajustado em meses curtos, resto na primeira'
);
select results_eq(
  $$select data from public.gerar_parcelas(5000, '2027-01-31', 2)$$,
  $$values ('2027-01-31'::date), ('2027-02-28'::date)$$,
  'parcelas: 31/01 em 2x cai em 28/02'
);
select is(
  (select sum(valor_centavos)::bigint from public.gerar_parcelas(99999, '2026-10-15', 12)),
  99999::bigint,
  'parcelas: a soma das 12 parcelas é exatamente o total'
);
select throws_ok(
  $$select * from public.gerar_parcelas(10000, '2026-10-15', 13)$$,
  '22023', null, 'parcelas: no máximo 12x'
);
select is(public.numero_parcela_divida(7, '2026-10', '2026-10'), 8, 'dívida: 7 já pagas, no mês de início é a parcela 8');

-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

update public.profiles set meta_desnecessario_centavos = 100000;
update public.contas set saldo_inicial_centavos = 500000;

insert into public.cartoes (id, nome, cor, limite_centavos, dia_fechamento, dia_vencimento)
values ('c0000000-0000-4000-8000-0000000000c1', 'Roxinho', '#5B4A8A', 200000, 10, 20);

insert into public.receitas (valor_centavos, descricao, data, conta_id)
values (50000, 'Salário', '2026-10-01', (select id from public.contas));

insert into public.gastos (id, valor_centavos, descricao, data, origem, conta_id, tipo) values
  ('c0000000-0000-4000-8000-000000000001', 10000, 'Mercado', '2026-10-03', 'pix', (select id from public.contas), 'necessario'),
  ('c0000000-0000-4000-8000-000000000002', 75000, 'Show', '2026-10-01', 'dinheiro', (select id from public.contas), 'desnecessario'),
  ('c0000000-0000-4000-8000-000000000004', 1000, 'Padaria', '2026-10-20', 'pix', (select id from public.contas), 'necessario'),
  ('c0000000-0000-4000-8000-000000000005', 7777, 'Duplicado', '2026-10-02', 'pix', (select id from public.contas), 'necessario');

update public.gastos set deleted_at = now() where id = 'c0000000-0000-4000-8000-000000000005';

insert into public.gastos (valor_centavos, descricao, data, origem, cartao_id, tipo,
                           parcela_atual, total_parcelas, grupo_parcelas)
select p.valor_centavos, 'Geladeira', p.data, 'cartao', 'c0000000-0000-4000-8000-0000000000c1',
       'necessario', p.parcela, 3, 'c0000000-0000-4000-8000-00000000009a'
from public.gerar_parcelas(30000, '2026-10-05', 3) p;

insert into public.gastos (id, valor_centavos, descricao, data, origem, cartao_id, tipo)
values ('c0000000-0000-4000-8000-000000000003', 5000, 'Farmácia', '2026-10-11', 'cartao',
        'c0000000-0000-4000-8000-0000000000c1', 'necessario');

insert into public.dividas (id, nome, tipo, valor_parcela_centavos, dia_vencimento, total_parcelas,
                            parcelas_ja_pagas, mes_inicio_ref, forma_pagamento, conta_id)
values ('c0000000-0000-4000-8000-0000000000d1', 'Financiamento', 'financiamento', 20000, 15, 12,
        5, '2026-08', 'conta', (select id from public.contas));

insert into public.dividas (id, nome, tipo, valor_parcela_centavos, dia_vencimento, infinita,
                            forma_pagamento, cartao_id)
values ('c0000000-0000-4000-8000-0000000000d2', 'Streaming', 'assinatura', 5000, 1, true,
        'cartao', 'c0000000-0000-4000-8000-0000000000c1');

insert into public.dividas (id, nome, tipo, valor_parcela_centavos, dia_vencimento, infinita,
                            forma_pagamento, conta_id)
values ('c0000000-0000-4000-8000-0000000000d3', 'Aluguel', 'aluguel', 30000, 2, true,
        'conta', (select id from public.contas));

insert into public.projetos (id, nome, orcamento_centavos, descontar_do_saldo)
values ('c0000000-0000-4000-8000-0000000000e1', 'Viagem', 2500, true),
       ('c0000000-0000-4000-8000-0000000000e2', 'Festa', null, false);

insert into public.projeto_gastos (projeto_id, descricao, valor_centavos, data)
values ('c0000000-0000-4000-8000-0000000000e1', 'Passagem', 3000, '2026-10-02'),
       ('c0000000-0000-4000-8000-0000000000e2', 'Buffet', 99900, '2026-10-02');

-- -----------------------------------------------------------------------------
-- Cartão e fatura (regra 3)
-- -----------------------------------------------------------------------------

select results_eq(
  $$select fatura_mes_ref from public.gastos where origem = 'cartao' order by data$$,
  array['2026-10', '2026-11', '2026-11', '2026-12'],
  'cada compra e parcela entra na fatura certa'
);

update public.cartoes set dia_fechamento = 4 where id = 'c0000000-0000-4000-8000-0000000000c1';
select is(
  (select fatura_mes_ref from public.gastos where data = '2026-10-05'),
  '2026-10',
  'mudar o dia de fechamento não move compras já lançadas'
);
update public.cartoes set dia_fechamento = 10 where id = 'c0000000-0000-4000-8000-0000000000c1';

update public.gastos set data = '2026-10-09' where id = 'c0000000-0000-4000-8000-000000000003';
select is(
  (select fatura_mes_ref from public.gastos where id = 'c0000000-0000-4000-8000-000000000003'),
  '2026-10',
  'editar a data da compra recalcula a fatura'
);
update public.gastos set data = '2026-10-11' where id = 'c0000000-0000-4000-8000-000000000003';

-- -----------------------------------------------------------------------------
-- Dívidas (regra 5)
-- -----------------------------------------------------------------------------

select results_eq(
  $$select nome, parcela_numero, status::text from public.dividas_do_mes('2026-10') order by nome$$,
  $$values ('Aluguel'::text, 1, 'atrasada'::text),
           ('Financiamento'::text, 8, 'pendente'::text),
           ('Streaming'::text, 1, 'atrasada'::text)$$,
  'outubro: parcela 8/12, recorrentes vencidas sem pagamento ficam atrasadas'
);
select results_eq(
  $$select parcelas_restantes, saldo_devedor_centavos
    from public.dividas_do_mes('2026-10') where nome = 'Financiamento'$$,
  $$values (4, 80000::bigint)$$,
  'saldo devedor após o mês = (total − n) × valor'
);
select results_eq(
  $$select nome, parcela_numero, status::text, paga_antes_do_cadastro
    from public.dividas_do_mes('2026-07')$$,
  $$values ('Financiamento'::text, 5, 'paga'::text, true)$$,
  'julho: parcela anterior ao cadastro aparece como paga; recorrentes ainda não existiam'
);
select results_eq(
  $$select nome, parcela_numero, status::text, paga_antes_do_cadastro
    from public.dividas_do_mes('2026-09')$$,
  $$values ('Financiamento'::text, 7, 'atrasada'::text, false)$$,
  'setembro: parcela 7 (depois do início) sem pagamento fica atrasada'
);
select is(
  (select parcela_numero from public.dividas_do_mes('2027-02') where nome = 'Financiamento'),
  12,
  'fevereiro/2027: última parcela (12/12)'
);
select is_empty(
  $$select * from public.dividas_do_mes('2027-03') where nome = 'Financiamento'$$,
  'março/2027: parcelada já terminou e não aparece'
);
select throws_ok(
  $$insert into public.dividas_pagamentos (divida_id, mes_ref)
    values ('c0000000-0000-4000-8000-0000000000d1', '2026-07')$$,
  '22023', null, 'não paga parcela que já estava paga antes do cadastro'
);
select throws_ok(
  $$insert into public.dividas_pagamentos (divida_id, mes_ref)
    values ('c0000000-0000-4000-8000-0000000000d2', '2026-09')$$,
  '22023', null, 'não paga recorrente antes do início'
);

-- Pagamentos: Streaming (no cartão) e Aluguel (na conta).
insert into public.dividas_pagamentos (divida_id, mes_ref)
values ('c0000000-0000-4000-8000-0000000000d2', '2026-10'),
       ('c0000000-0000-4000-8000-0000000000d3', '2026-10');

select results_eq(
  $$select forma_pagamento::text, fatura_mes_ref, valor_centavos, conta_id is null
    from public.dividas_pagamentos where divida_id = 'c0000000-0000-4000-8000-0000000000d2'$$,
  $$values ('cartao'::text, '2026-10'::text, 5000::bigint, true)$$,
  'dívida paga no cartão entra na fatura do vencimento (regra 4)'
);

-- Fatura de outubro paga com a Carteira (hoje, 03/10).
insert into public.faturas_pagas (cartao_id, mes_ref, conta_id)
values ('c0000000-0000-4000-8000-0000000000c1', '2026-10', (select id from public.contas));

select results_eq(
  $$select status::text, compras_centavos, dividas_centavos, total_centavos,
           data_fechamento, data_vencimento
    from public.fatura_cartao('c0000000-0000-4000-8000-0000000000c1', '2026-10')$$,
  $$values ('paga'::text, 10000::bigint, 5000::bigint, 15000::bigint,
            '2026-10-10'::date, '2026-10-20'::date)$$,
  'fatura de outubro: parcela 1/3 + assinatura, paga'
);
select results_eq(
  $$select status::text, total_centavos, qtd_compras
    from public.fatura_cartao('c0000000-0000-4000-8000-0000000000c1', '2026-11')$$,
  $$values ('aberta'::text, 15000::bigint, 2)$$,
  'fatura de novembro: compra após o fechamento + parcela 2/3, aberta'
);
select results_eq(
  $$select limite_usado_centavos, limite_disponivel_centavos, limite_percentual
    from public.fatura_cartao('c0000000-0000-4000-8000-0000000000c1', '2026-11')$$,
  $$values (25000::bigint, 175000::bigint, 12.50::numeric)$$,
  'limite usado = faturas não pagas, incluindo parcelas futuras'
);

-- -----------------------------------------------------------------------------
-- Limite do cartão (limite_cartao)
-- Usado agora: parcelas 2/3 e 3/3 da Geladeira (20000) + Farmácia (5000).
-- A fatura de outubro (parcela 1/3 + Streaming) está paga e não conta.
-- No fim da seção tudo volta ao estado anterior, para não afetar o resto.
-- -----------------------------------------------------------------------------

select results_eq(
  $$select limite_centavos, usado_centavos, disponivel_centavos, percentual
    from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')$$,
  $$values (200000::bigint, 25000::bigint, 175000::bigint, 12.50::numeric)$$,
  'limite: parcelas futuras contam e a fatura já paga não conta'
);
select is(
  (select limite_usado_centavos from public.faturas_do_mes('2026-10')
    where cartao_id = 'c0000000-0000-4000-8000-0000000000c1'),
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  'faturas_do_mes mostra o mesmo limite usado de limite_cartao'
);

-- Compra à vista em 15/10 (entra na fatura de novembro).
insert into public.gastos (id, valor_centavos, descricao, data, origem, cartao_id, tipo)
values ('c0000000-0000-4000-8000-000000000006', 40000, 'TV', '2026-10-15', 'cartao',
        'c0000000-0000-4000-8000-0000000000c1', 'desnecessario');
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  65000::bigint,
  'limite: compra à vista consome o valor total'
);

-- Compra parcelada em 4x a partir de 15/10 (faturas de novembro a fevereiro).
insert into public.gastos (valor_centavos, descricao, data, origem, cartao_id, tipo,
                           parcela_atual, total_parcelas, grupo_parcelas)
select p.valor_centavos, 'Celular', p.data, 'cartao', 'c0000000-0000-4000-8000-0000000000c1',
       'necessario', p.parcela, 4, 'c0000000-0000-4000-8000-00000000009b'
from public.gerar_parcelas(80000, '2026-10-15', 4) p;
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  145000::bigint,
  'limite: compra parcelada consome todas as parcelas, inclusive as de meses futuros'
);

-- Excluir a compra (exclusão lógica) e desfazer.
update public.gastos set deleted_at = now()
 where grupo_parcelas = 'c0000000-0000-4000-8000-00000000009b';
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  65000::bigint,
  'limite: excluir a compra devolve o limite na hora'
);
update public.gastos set deleted_at = null
 where grupo_parcelas = 'c0000000-0000-4000-8000-00000000009b';
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  145000::bigint,
  'limite: desfazer a exclusão volta a consumir o limite'
);

-- Conta a pagar recorrente no cartão (Streaming): ocupa a parcela do mês atual
-- enquanto ela não está paga. A de outubro já está paga, por isso não contava.
delete from public.dividas_pagamentos
 where divida_id = 'c0000000-0000-4000-8000-0000000000d2' and mes_ref = '2026-10';
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  150000::bigint,
  'limite: recorrente no cartão ocupa a parcela do mês atual enquanto não está paga'
);
insert into public.dividas_pagamentos (divida_id, mes_ref)
values ('c0000000-0000-4000-8000-0000000000d2', '2026-10');
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  145000::bigint,
  'limite: marcar a parcela do mês como paga libera o valor dela'
);

-- Fatura de novembro paga: Geladeira 2/3 + Farmácia + TV + Celular 1/4 = 75000.
insert into public.faturas_pagas (cartao_id, mes_ref, conta_id)
values ('c0000000-0000-4000-8000-0000000000c1', '2026-11', (select id from public.contas));
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  70000::bigint,
  'limite: marcar a fatura como paga devolve o valor dela ao limite'
);

delete from public.faturas_pagas
 where cartao_id = 'c0000000-0000-4000-8000-0000000000c1' and mes_ref = '2026-11';
delete from public.gastos
 where id = 'c0000000-0000-4000-8000-000000000006'
    or grupo_parcelas = 'c0000000-0000-4000-8000-00000000009b';
select is(
  (select usado_centavos from public.limite_cartao('c0000000-0000-4000-8000-0000000000c1')),
  25000::bigint,
  'limite: desfazer o pagamento da fatura e remover as compras volta ao valor inicial'
);

-- -----------------------------------------------------------------------------
-- Saldo (regra 1) sem dupla contagem (regra 4) e projetos isolados (regra 9)
-- 500000 + 50000 − 10000 − 75000 − 15000 (fatura) − 30000 (aluguel) − 3000 (Viagem)
-- -----------------------------------------------------------------------------

select is(public.saldo_total(), 417000::bigint, 'saldo hoje: fatura paga uma vez, assinatura não é descontada de novo');
select is(public.saldo_total('2026-10-31'), 416000::bigint, 'saldo no fim do mês inclui o Pix futuro');
select is(public.saldo_total('2026-09-30'), 500000::bigint, 'saldo em setembro: só o saldo inicial');

-- -----------------------------------------------------------------------------
-- Resumo do mês (regras 2, 6 e 7)
-- -----------------------------------------------------------------------------

select results_eq(
  $$select situacao::text, gastos_mes_centavos, necessario_centavos, desnecessario_centavos,
           receitas_mes_centavos
    from public.resumo_mes('2026-10')$$,
  $$values ('atual'::text, 101000::bigint, 26000::bigint, 75000::bigint, 50000::bigint)$$,
  'gastos do mês pela data da compra; projetos e excluídos ficam de fora'
);
select results_eq(
  $$select desnecessario_percentual, desnecessario_projecao_centavos, desnecessario_dias_para_estourar
    from public.resumo_mes('2026-10')$$,
  $$values (75.00::numeric, 775000::bigint, 1)$$,
  'desnecessários: 75% da meta; no ritmo atual passa da meta em ~1 dia'
);
select results_eq(
  $$select dividas_total_centavos, dividas_pagas_centavos, dividas_pendentes_centavos,
           saldo_devedor_centavos, recorrentes_mensal_centavos
    from public.resumo_mes('2026-10')$$,
  $$values (55000::bigint, 35000::bigint, 20000::bigint, 80000::bigint, 35000::bigint)$$,
  'dívidas de outubro: total, pago, falta, saldo devedor e recorrentes'
);
select results_eq(
  $$select faturas_pendentes_centavos, sobra_mes_centavos, dias_restantes,
           pode_gastar_dia_centavos, lancou_hoje
    from public.resumo_mes('2026-10')$$,
  $$values (0::bigint, 397000::bigint, 29, 13689::bigint, true)$$,
  'pode gastar por dia = (417000 − 20000) ÷ 29 dias'
);
select results_eq(
  $$select situacao::text, data_referencia, saldo_total_centavos, gastos_mes_centavos,
           dividas_pendentes_centavos, faturas_pendentes_centavos, sobra_mes_centavos,
           dias_restantes, pode_gastar_dia_centavos
    from public.resumo_mes('2026-11')$$,
  $$values ('futuro'::text, '2026-10-31'::date, 416000::bigint, 10000::bigint,
            55000::bigint, 15000::bigint, 346000::bigint, 30, 12033::bigint)$$,
  'novembro (previsto): fatura a vencer e dívidas pendentes'
);
select results_eq(
  $$select situacao::text, saldo_total_centavos, dias_restantes, pode_gastar_dia_centavos is null
    from public.resumo_mes('2026-09')$$,
  $$values ('passado'::text, 500000::bigint, 0, true)$$,
  'setembro (realizado): sem dias restantes'
);

-- -----------------------------------------------------------------------------
-- Projetos (regra 9)
-- -----------------------------------------------------------------------------

select results_eq(
  $$select total_centavos, qtd_gastos, percentual, restante_centavos, excedente_centavos
    from public.totais_projeto('c0000000-0000-4000-8000-0000000000e1')$$,
  $$values (3000::bigint, 1, 120.00::numeric, 0::bigint, 500::bigint)$$,
  'projeto com orçamento estourado em 500'
);
select results_eq(
  $$select total_centavos, percentual is null, excedente_centavos is null
    from public.totais_projeto('c0000000-0000-4000-8000-0000000000e2')$$,
  $$values (99900::bigint, true, true)$$,
  'projeto sem orçamento'
);
select is(
  (select conta_id from public.projetos where id = 'c0000000-0000-4000-8000-0000000000e1'),
  (select id from public.contas),
  'projeto que desconta do saldo usa a Carteira por padrão'
);

-- -----------------------------------------------------------------------------
-- Edições de dívidas
-- -----------------------------------------------------------------------------

update public.dividas set valor_parcela_centavos = 35000 where id = 'c0000000-0000-4000-8000-0000000000d3';
select is(
  (select valor_centavos from public.dividas_do_mes('2026-10') where nome = 'Aluguel'),
  30000::bigint,
  'novo valor não altera parcela já paga'
);
select is(
  (select valor_centavos from public.dividas_do_mes('2026-11') where nome = 'Aluguel'),
  35000::bigint,
  'novo valor vale para as parcelas não pagas'
);

update public.dividas set parcelas_ja_pagas = 8 where id = 'c0000000-0000-4000-8000-0000000000d1';
select is(
  (select mes_inicio_ref from public.dividas where id = 'c0000000-0000-4000-8000-0000000000d1'),
  '2026-10',
  'editar "já pagas" recomeça a contagem no mês atual'
);
select is(
  (select parcela_numero from public.dividas_do_mes('2026-10') where nome = 'Financiamento'),
  9,
  'depois da edição, outubro é a parcela 9'
);

insert into public.dividas_pagamentos (divida_id, mes_ref, valor_centavos)
values ('c0000000-0000-4000-8000-0000000000d1', '2026-11', 1);
select is(
  (select valor_centavos from public.dividas_pagamentos
    where divida_id = 'c0000000-0000-4000-8000-0000000000d1' and mes_ref = '2026-11'),
  20000::bigint,
  'o valor do pagamento vem da dívida, não do cliente'
);

delete from public.dividas_pagamentos
 where divida_id = 'c0000000-0000-4000-8000-0000000000d2' and mes_ref = '2026-10';
select is(
  (select status::text from public.dividas_do_mes('2026-10') where nome = 'Streaming'),
  'atrasada',
  'desfazer o pagamento volta o status'
);

update public.dividas set ativa = false where id = 'c0000000-0000-4000-8000-0000000000d3';
select is(
  (select count(*) from public.dividas_do_mes('2026-10') where nome = 'Aluguel'),
  1::bigint,
  'dívida encerrada continua no mês em que foi paga'
);
select is(
  (select count(*) from public.dividas_do_mes('2026-11') where nome = 'Aluguel'),
  0::bigint,
  'dívida encerrada some dos meses seguintes'
);

update public.dividas set deleted_at = now() where id = 'c0000000-0000-4000-8000-0000000000d2';
select is(
  (select count(*) from public.dividas_do_mes('2026-10') where nome = 'Streaming'),
  0::bigint,
  'dívida excluída some de todos os meses'
);

-- -----------------------------------------------------------------------------
-- Integridade
-- -----------------------------------------------------------------------------

select is(
  tests.estado($$insert into public.gastos (valor_centavos, descricao, origem, conta_id, tipo)
                 values (0, 'Zero', 'pix', (select id from public.contas), 'necessario')$$),
  '23514', 'gasto com valor zero é rejeitado'
);
select is(
  tests.estado($$insert into public.cartoes (nome, limite_centavos, dia_fechamento, dia_vencimento)
                 values ('X', 1000, 32, 10)$$),
  '23514', 'dia de fechamento acima de 31 é rejeitado'
);
select is(
  tests.estado($$insert into public.gastos (valor_centavos, descricao, origem, conta_id, tipo,
                                             parcela_atual, total_parcelas, grupo_parcelas)
                 values (1000, 'Pix parcelado', 'pix', (select id from public.contas), 'necessario',
                         1, 3, gen_random_uuid())$$),
  '23514', 'só compra no cartão pode ser parcelada'
);
select is(
  tests.estado($$insert into public.gastos (valor_centavos, descricao, origem, cartao_id, tipo,
                                             parcela_atual, total_parcelas, grupo_parcelas)
                 values (1000, 'Muitas', 'cartao', 'c0000000-0000-4000-8000-0000000000c1',
                         'necessario', 1, 13, gen_random_uuid())$$),
  '23514', 'mais de 12 parcelas é rejeitado'
);
select is(
  tests.estado($$insert into public.gastos (valor_centavos, descricao, origem, tipo)
                 values (1000, 'Sem conta', 'pix', 'necessario')$$),
  '23514', 'Pix sem conta é rejeitado'
);
select is(
  tests.estado($$insert into public.gastos (valor_centavos, descricao, data, origem, cartao_id, tipo,
                                             parcela_atual, total_parcelas, grupo_parcelas)
                 values (10000, 'Geladeira', '2026-10-05', 'cartao',
                         'c0000000-0000-4000-8000-0000000000c1', 'necessario', 1, 3,
                         'c0000000-0000-4000-8000-00000000009a')$$),
  '23505', 'parcela repetida no mesmo grupo é rejeitada'
);
select is(
  tests.estado($$insert into public.dividas (nome, valor_parcela_centavos, dia_vencimento,
                                              total_parcelas, parcelas_ja_pagas, conta_id)
                 values ('X', 1000, 5, 10, 10, (select id from public.contas))$$),
  '23514', 'parcelas já pagas precisa ser menor que o total'
);
select is(
  tests.estado($$insert into public.faturas_pagas (cartao_id, mes_ref, conta_id)
                 values ('c0000000-0000-4000-8000-0000000000c1', '2026-13',
                         (select id from public.contas))$$),
  '23514', 'mês fora do formato AAAA-MM é rejeitado'
);
select is(
  tests.estado($$insert into public.faturas_pagas (cartao_id, mes_ref, conta_id)
                 values ('c0000000-0000-4000-8000-0000000000c1', '2026-10',
                         (select id from public.contas))$$),
  '23505', 'uma fatura paga por cartão e mês'
);

insert into public.aprendizado_categoria (termo, categoria_id, tipo)
values ('  Pão   de  Queijo ', (select id from public.categorias where nome = 'Alimentação'), 'necessario');
select is(
  (select termo from public.aprendizado_categoria),
  'pão de queijo',
  'aprendizado normaliza o termo'
);

-- Ritmo com dízima (40000 / 3 por dia): faltam 40000, exatamente 3 dias.
-- A fórmula anterior (dividir pelo ritmo arredondado) dava 4. Igual ao TypeScript.
reset role;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'davi@teste.local', '',
        '{"provider":"email","providers":["email"]}', '{"nome":"Davi"}', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.profiles set meta_desnecessario_centavos = 80000;
insert into public.gastos (valor_centavos, descricao, data, origem, conta_id, tipo)
values (40000, 'Jantar', '2026-10-01', 'pix', (select id from public.contas), 'desnecessario');
select results_eq(
  $$select desnecessario_projecao_centavos, desnecessario_dias_para_estourar
    from public.resumo_mes('2026-10')$$,
  $$values (413333::bigint, 3)$$,
  'projeção com ritmo em dízima: exatamente 3 dias, sem dia a mais'
);

-- -----------------------------------------------------------------------------
-- Contas a pagar no cartão comprometem o limite pelo saldo devedor (migration 09)
-- Usuária Eva, separada do cenário acima. Nubank: limite 400000, fecha dia 10.
-- Visa: limite 100000. "Hoje" continua 03/10/2026.
-- -----------------------------------------------------------------------------
reset role;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'eva@teste.local', '',
        '{"provider":"email","providers":["email"]}', '{"nome":"Eva"}', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.cartoes (id, nome, limite_centavos, dia_fechamento, dia_vencimento)
values ('e0000000-0000-4000-8000-0000000000c1', 'Nubank', 400000, 10, 20),
       ('e0000000-0000-4000-8000-0000000000c2', 'Visa', 100000, 5, 15);

-- A) Dívida de 12 × 10000 no Nubank: compromete o total na hora.
insert into public.dividas (id, nome, valor_parcela_centavos, dia_vencimento, total_parcelas,
                            forma_pagamento, cartao_id)
values ('e0000000-0000-4000-8000-0000000000d1', 'Notebook', 10000, 15, 12,
        'cartao', 'e0000000-0000-4000-8000-0000000000c1');
select results_eq(
  $$select limite_centavos, usado_centavos, disponivel_centavos, percentual
    from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')$$,
  $$values (400000::bigint, 120000::bigint, 280000::bigint, 30.00::numeric)$$,
  'A: conta a pagar de 12 × 100,00 no cartão compromete 1.200,00 na hora'
);

-- 2) Sem nenhum pagamento, o comprometimento não muda, nem com meses passando.
select set_config('app.hoje', '2027-01-10', true);
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  120000::bigint,
  '2: sem pagar nenhuma parcela, o usado continua 120000 (mesmo três meses depois)'
);
select set_config('app.hoje', '2026-10-03', true);

-- B) Pagar a parcela de outubro libera exatamente 10000.
insert into public.dividas_pagamentos (divida_id, mes_ref)
values ('e0000000-0000-4000-8000-0000000000d1', '2026-10');
select results_eq(
  $$select usado_centavos, disponivel_centavos
    from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')$$,
  $$values (110000::bigint, 290000::bigint)$$,
  'B: pagar uma parcela de 100,00 libera 100,00 do limite'
);

-- 7) A parcela paga vai para a fatura, mas não volta a contar no limite.
select results_eq(
  $$select l.usado_centavos,
           (select sum(p.valor_centavos)::bigint from public.dividas_pagamentos p
             where p.divida_id = 'e0000000-0000-4000-8000-0000000000d1'),
           public.total_fatura('e0000000-0000-4000-8000-0000000000c1', '2026-11')
    from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1') l$$,
  $$values (110000::bigint, 10000::bigint, 10000::bigint)$$,
  '7: a parcela paga (10000) está na fatura e fora do limite; o usado é só o saldo devedor, sem dupla contagem'
);

-- F) Fatura e limite são métricas diferentes.
select results_eq(
  $$select f.total_centavos, f.dividas_centavos, l.usado_centavos
    from public.fatura_cartao('e0000000-0000-4000-8000-0000000000c1', '2026-11') f,
         public.limite_cartao('e0000000-0000-4000-8000-0000000000c1') l$$,
  $$values (10000::bigint, 10000::bigint, 110000::bigint)$$,
  'F: a fatura tem só a parcela do ciclo; o limite tem todo o saldo devedor'
);
insert into public.gastos (valor_centavos, descricao, data, origem, cartao_id, tipo,
                           parcela_atual, total_parcelas, grupo_parcelas)
select p.valor_centavos, 'Fone', p.data, 'cartao', 'e0000000-0000-4000-8000-0000000000c1',
       'desnecessario', p.parcela, 3, 'e0000000-0000-4000-8000-00000000009a'
from public.gerar_parcelas(30000, '2026-10-05', 3) p;
select results_eq(
  $$select f.compras_centavos, l.usado_centavos
    from public.fatura_cartao('e0000000-0000-4000-8000-0000000000c1', '2026-10') f,
         public.limite_cartao('e0000000-0000-4000-8000-0000000000c1') l$$,
  $$values (10000::bigint, 140000::bigint)$$,
  'F: compra parcelada em 3 × 100,00: a fatura tem 100,00 e o limite os 300,00 (sem contar a conta a pagar duas vezes)'
);

-- D) Duas contas a pagar no mesmo cartão somam.
insert into public.dividas (id, nome, valor_parcela_centavos, dia_vencimento, total_parcelas,
                            forma_pagamento, cartao_id)
values ('e0000000-0000-4000-8000-0000000000d2', 'Celular', 5000, 20, 6,
        'cartao', 'e0000000-0000-4000-8000-0000000000c1');
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  170000::bigint,
  'D: duas contas a pagar e uma compra no mesmo cartão somam (110000 + 30000 + 30000)'
);

-- E) Cartões diferentes nunca se misturam.
insert into public.dividas (id, nome, valor_parcela_centavos, dia_vencimento, total_parcelas,
                            forma_pagamento, cartao_id)
values ('e0000000-0000-4000-8000-0000000000d3', 'Curso', 10000, 10, 3,
        'cartao', 'e0000000-0000-4000-8000-0000000000c2');
select results_eq(
  $$select (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
           (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c2'))$$,
  $$values (170000::bigint, 30000::bigint)$$,
  'E: contas a pagar de cartões diferentes ficam cada uma no seu cartão'
);

-- Alterações recalculam o comprometimento.
update public.dividas set valor_parcela_centavos = 6000
 where id = 'e0000000-0000-4000-8000-0000000000d2';
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  176000::bigint,
  'alterar o valor da parcela recalcula o saldo devedor (6 × 6000)'
);
update public.dividas set cartao_id = 'e0000000-0000-4000-8000-0000000000c1'
 where id = 'e0000000-0000-4000-8000-0000000000d3';
select results_eq(
  $$select (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
           (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c2'))$$,
  $$values (206000::bigint, 0::bigint)$$,
  'trocar o cartão da conta move o comprometimento para o novo cartão'
);
update public.dividas set total_parcelas = 10
 where id = 'e0000000-0000-4000-8000-0000000000d1';
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  186000::bigint,
  'alterar o número de parcelas recalcula: 10 parcelas, 1 paga, saldo 90000'
);
update public.dividas set ativa = false
 where id = 'e0000000-0000-4000-8000-0000000000d2';
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  150000::bigint,
  'encerrar a conta a pagar (ativa = false) libera o saldo dela'
);

-- C) Excluir o que resta devolve todo o limite; desfazer volta a comprometer.
update public.dividas set deleted_at = now()
 where id in ('e0000000-0000-4000-8000-0000000000d1', 'e0000000-0000-4000-8000-0000000000d3');
update public.gastos set deleted_at = now()
 where grupo_parcelas = 'e0000000-0000-4000-8000-00000000009a';
select results_eq(
  $$select usado_centavos, disponivel_centavos
    from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')$$,
  $$values (0::bigint, 400000::bigint)$$,
  'C: excluir as contas e a compra restantes devolve todo o limite'
);
update public.dividas set deleted_at = null
 where id = 'e0000000-0000-4000-8000-0000000000d1';
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c1')),
  90000::bigint,
  'desfazer a exclusão volta a comprometer o saldo devedor'
);

-- E) Editar a conta de 1.200,00 para 1.500,00 e depois quitar tudo (cartão Elo).
insert into public.cartoes (id, nome, limite_centavos, dia_fechamento, dia_vencimento)
values ('e0000000-0000-4000-8000-0000000000c3', 'Elo', 400000, 10, 20);
insert into public.dividas (id, nome, valor_parcela_centavos, dia_vencimento, total_parcelas,
                            forma_pagamento, cartao_id)
values ('e0000000-0000-4000-8000-0000000000d4', 'Geladeira', 10000, 15, 12,
        'cartao', 'e0000000-0000-4000-8000-0000000000c3');
update public.dividas set valor_parcela_centavos = 12500
 where id = 'e0000000-0000-4000-8000-0000000000d4';
select is(
  (select usado_centavos from public.limite_cartao('e0000000-0000-4000-8000-0000000000c3')),
  150000::bigint,
  'E: editar a conta de 1.200,00 para 1.500,00 (12 × 125,00) faz o usado refletir 1.500,00'
);
insert into public.dividas_pagamentos (divida_id, mes_ref)
select 'e0000000-0000-4000-8000-0000000000d4', public.mes_add('2026-10', n)
from generate_series(0, 11) as n;
select results_eq(
  $$select usado_centavos, disponivel_centavos
    from public.limite_cartao('e0000000-0000-4000-8000-0000000000c3')$$,
  $$values (0::bigint, 400000::bigint)$$,
  'quitar todas as parcelas devolve todo o limite (usado 0, disponível 400000)'
);

select * from finish();
rollback;

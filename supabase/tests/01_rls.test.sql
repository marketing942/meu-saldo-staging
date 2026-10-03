-- =============================================================================
-- Teste de RLS com dois usuários (Ana e Bruno).
--
-- Para cada tabela, Bruno (autenticado) NÃO consegue:
--   ler, alterar ou apagar linhas da Ana; inserir linhas em nome dela;
--   transferir uma linha própria para ela; nem apontar para registros dela
--   (conta, cartão, categoria, dívida, projeto).
-- Também verifica: as RPCs não vazam dados, `anon` não acessa nada, a Ana fica
-- intacta depois das tentativas e apagar o usuário apaga todos os dados dele.
--
-- Rodar: scripts/db-test.sh   (ou: supabase test db)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(113);

-- -----------------------------------------------------------------------------
-- Auxiliares (existem só dentro desta transação)
-- -----------------------------------------------------------------------------

create schema tests;
grant usage on schema tests to anon, authenticated;

create table tests.ref (chave text primary key, id uuid not null);
create table tests.amostras (tabela text primary key, dados jsonb not null);
create table tests.fotos (chave text primary key, dados jsonb not null);
grant select on tests.ref, tests.amostras, tests.fotos to anon, authenticated;

create function tests.ref(p_chave text) returns uuid
language sql stable as $$
  select id from tests.ref where chave = p_chave;
$$;

create function tests.tabelas() returns text[]
language sql immutable as $$
  select array[
    'profiles', 'contas', 'categorias', 'cartoes', 'gastos', 'receitas',
    'faturas_pagas', 'dividas', 'dividas_pagamentos',
    'projetos', 'projeto_gastos', 'aprendizado_categoria'
  ];
$$;

create function tests.criar_usuario(p_id uuid, p_email text, p_nome text) returns uuid
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nome', p_nome), now(), now()
  );
  return p_id;
end;
$$;

-- Simula o JWT do usuário (formatos antigo e novo lidos por auth.uid()).
create function tests.entrar(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true);
  perform set_config(
    'request.jwt.claims',
    case when p_id is null then ''
         else json_build_object('sub', p_id, 'role', 'authenticated')::text end,
    true
  );
end;
$$;

-- Executa um comando e devolve 'ok' ou o SQLSTATE do erro.
create function tests.estado(p_sql text, p_dados jsonb default null) returns text
language plpgsql as $$
begin
  if p_dados is null then
    execute p_sql;
  else
    execute p_sql using p_dados;
  end if;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

-- Quantidade de linhas do usuário em cada tabela (roda como postgres).
create function tests.contagem(p_dono uuid) returns jsonb
language plpgsql as $$
declare
  t text;
  v_qtd bigint;
  v_resultado jsonb := '{}';
begin
  foreach t in array tests.tabelas() loop
    execute format(
      'select count(*) from public.%I where %I = $1',
      t, case when t = 'profiles' then 'id' else 'user_id' end
    ) into v_qtd using p_dono;
    v_resultado := v_resultado || jsonb_build_object(t, v_qtd);
  end loop;
  return v_resultado;
end;
$$;

-- Cria uma linha em cada tabela para o usuário autenticado (passa pelo RLS).
create function tests.popular() returns void
language plpgsql as $$
declare
  v_conta uuid;
  v_categoria uuid;
  v_cartao uuid;
  v_divida uuid;
  v_projeto uuid;
  v_grupo uuid := gen_random_uuid();
begin
  update public.profiles
     set nome = nome || ' Teste', meta_desnecessario_centavos = 100000, mes_selecionado = '2026-10'
   where id = auth.uid();

  select c.id into strict v_conta from public.contas c;
  update public.contas set saldo_inicial_centavos = 500000 where id = v_conta;

  insert into public.categorias (nome, cor) values ('Pets', '#3C8D6A')
  returning id into v_categoria;

  insert into public.cartoes (nome, cor, limite_centavos, dia_fechamento, dia_vencimento)
  values ('Cartão', '#2E4A7A', 300000, 10, 20)
  returning id into v_cartao;

  insert into public.gastos (valor_centavos, descricao, data, origem, conta_id, categoria_id, tipo)
  values (2500, 'Ração', '2026-10-02', 'pix', v_conta, v_categoria, 'necessario');

  insert into public.gastos (
    valor_centavos, descricao, data, origem, cartao_id, categoria_id, tipo,
    parcela_atual, total_parcelas, grupo_parcelas
  )
  select p.valor_centavos, 'Tênis', p.data, 'cartao', v_cartao, v_categoria, 'desnecessario',
         p.parcela, 3, v_grupo
  from public.gerar_parcelas(30000, '2026-10-05', 3) p;

  insert into public.receitas (valor_centavos, descricao, data, conta_id)
  values (400000, 'Salário', '2026-10-01', v_conta);

  insert into public.faturas_pagas (cartao_id, mes_ref, conta_id)
  values (v_cartao, '2026-09', v_conta);

  insert into public.dividas (
    nome, tipo, valor_parcela_centavos, dia_vencimento, total_parcelas,
    parcelas_ja_pagas, mes_inicio_ref, forma_pagamento, conta_id
  ) values ('Financiamento', 'financiamento', 50000, 15, 12, 7, '2026-10', 'conta', v_conta)
  returning id into v_divida;

  insert into public.dividas (
    nome, tipo, valor_parcela_centavos, dia_vencimento, infinita,
    mes_inicio_ref, forma_pagamento, cartao_id
  ) values ('Streaming', 'assinatura', 3990, 1, true, '2026-10', 'cartao', v_cartao);

  insert into public.dividas_pagamentos (divida_id, mes_ref) values (v_divida, '2026-10');

  insert into public.projetos (nome, orcamento_centavos, descontar_do_saldo)
  values ('Casamento', 300000, true)
  returning id into v_projeto;

  insert into public.projeto_gastos (projeto_id, descricao, valor_centavos, data)
  values (v_projeto, 'Presente', 45000, '2026-10-02');

  insert into public.aprendizado_categoria (termo, categoria_id, tipo)
  values ('  Ração  ', v_categoria, 'necessario');
end;
$$;

-- Guarda ids e uma linha de exemplo de cada tabela (roda como postgres).
create function tests.guardar(p_sufixo text, p_dono uuid) returns void
language plpgsql as $$
declare
  t text;
begin
  insert into tests.ref values
    ('conta_' || p_sufixo, (select id from public.contas where user_id = p_dono)),
    ('cartao_' || p_sufixo, (select id from public.cartoes where user_id = p_dono)),
    ('categoria_' || p_sufixo, (select id from public.categorias where user_id = p_dono and nome = 'Pets')),
    ('projeto_' || p_sufixo, (select id from public.projetos where user_id = p_dono)),
    ('gasto_' || p_sufixo, (select id from public.gastos where user_id = p_dono and origem = 'pix'));

  insert into tests.ref
  select 'divida_' || p_sufixo || '_' || d.forma_pagamento, d.id
  from public.dividas d where d.user_id = p_dono;

  insert into tests.fotos values (p_sufixo, tests.contagem(p_dono));

  foreach t in array tests.tabelas() loop
    execute format(
      'insert into tests.amostras
         select %L || %L, to_jsonb(x) from public.%I x
         where %I = $1 %s
         order by x.id limit 1',
      p_sufixo || ':', t, t,
      case when t = 'profiles' then 'id' else 'user_id' end,
      case when t = 'gastos' then 'and x.origem = ''pix''' else '' end
    ) using p_dono;
  end loop;
end;
$$;

-- Bateria de isolamento para uma tabela. Roda como o usuário autenticado.
create function tests.isolamento(
  p_tabela text,
  p_dono_alheio uuid,
  p_erro_insercao text,
  p_erro_referencia text
) returns setof text
language plpgsql as $$
declare
  v_coluna text := case when p_tabela = 'profiles' then 'id' else 'user_id' end;
  v_eu uuid := auth.uid();
  v_qtd bigint;
  v_dados jsonb;
  v_insert text := format(
    'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
    p_tabela, p_tabela
  );
begin
  execute format('select count(*) from public.%I where %I = $1', p_tabela, v_coluna)
    into v_qtd using v_eu;
  return next ok(v_qtd > 0, format('%s: enxerga as próprias linhas', p_tabela));

  execute format('select count(*) from public.%I where %I = $1', p_tabela, v_coluna)
    into v_qtd using p_dono_alheio;
  return next is(v_qtd, 0::bigint, format('%s: não lê linhas de outro usuário', p_tabela));

  execute format(
    'with x as (update public.%I set created_at = created_at where %I = $1 returning 1)
     select count(*) from x',
    p_tabela, v_coluna
  ) into v_qtd using p_dono_alheio;
  return next is(v_qtd, 0::bigint, format('%s: não altera linhas de outro usuário', p_tabela));

  execute format(
    'with x as (delete from public.%I where %I = $1 returning 1) select count(*) from x',
    p_tabela, v_coluna
  ) into v_qtd using p_dono_alheio;
  return next is(v_qtd, 0::bigint, format('%s: não apaga linhas de outro usuário', p_tabela));

  return next is(
    tests.estado(format(
      'update public.%I set %I = %L where %I = %L',
      p_tabela, v_coluna, p_dono_alheio, v_coluna, v_eu
    )),
    '42501',
    format('%s: não transfere linha própria para outro usuário', p_tabela)
  );

  -- Cópia de uma linha do outro usuário (vista pelo postgres), com novo id.
  select a.dados into strict v_dados from tests.amostras a where a.tabela = 'a:' || p_tabela;
  if p_tabela <> 'profiles' then
    v_dados := v_dados || jsonb_build_object('id', gen_random_uuid());
  end if;

  return next is(
    tests.estado(v_insert, v_dados),
    p_erro_insercao,
    format('%s: não insere linha em nome de outro usuário', p_tabela)
  );

  if p_erro_referencia is not null then
    -- Termo diferente para não esbarrar na unicidade (user_id, termo) do aprendizado.
    if v_dados ? 'termo' then
      v_dados := v_dados || jsonb_build_object('termo', 'termo exclusivo do teste');
    end if;
    return next is(
      tests.estado(v_insert, v_dados || jsonb_build_object('user_id', v_eu)),
      p_erro_referencia,
      format('%s: não aponta para registros de outro usuário', p_tabela)
    );
  end if;
end;
$$;

-- Visitante sem login: nenhuma tabela nem RPC.
create function tests.anon_sem_acesso() returns setof text
language plpgsql as $$
declare
  t text;
begin
  foreach t in array tests.tabelas() loop
    return next is(
      tests.estado(format('select count(*) from public.%I', t)),
      '42501',
      format('anon: sem acesso a %s', t)
    );
  end loop;
  return next is(
    tests.estado('select public.saldo_total()'),
    '42501',
    'anon: não executa RPC'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastro: o gatilho cria perfil, Carteira e categorias padrão
-- -----------------------------------------------------------------------------

select tests.criar_usuario('aaaaaaaa-0000-4000-8000-000000000001', 'ana@teste.local', 'Ana');
select tests.criar_usuario('bbbbbbbb-0000-4000-8000-000000000001', 'bruno@teste.local', 'Bruno');

select is(
  (select nome from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Ana',
  'novo usuário: perfil criado com o nome do cadastro'
);
select results_eq(
  $$select nome from public.contas where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  array['Carteira'],
  'novo usuário: conta Carteira criada'
);
select results_eq(
  $$select nome from public.categorias
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' order by nome$$,
  array['Alimentação', 'Assinaturas', 'Compras', 'Educação', 'Lazer', 'Moradia',
        'Outros', 'Saúde', 'Transporte'],
  'novo usuário: 9 categorias padrão'
);

-- -----------------------------------------------------------------------------
-- Cada usuário cria seus dados pela API (como authenticated)
-- -----------------------------------------------------------------------------

set local role authenticated;
select tests.entrar('aaaaaaaa-0000-4000-8000-000000000001');
select tests.popular();
select tests.entrar('bbbbbbbb-0000-4000-8000-000000000001');
select tests.popular();
reset role;

select tests.guardar('a', 'aaaaaaaa-0000-4000-8000-000000000001');
select tests.guardar('b', 'bbbbbbbb-0000-4000-8000-000000000001');

-- -----------------------------------------------------------------------------
-- Bruno tenta acessar os dados da Ana, tabela por tabela
-- -----------------------------------------------------------------------------

set local role authenticated;
select tests.entrar('bbbbbbbb-0000-4000-8000-000000000001');

select * from tests.isolamento('profiles',              'aaaaaaaa-0000-4000-8000-000000000001', '42501', null);
select * from tests.isolamento('contas',                'aaaaaaaa-0000-4000-8000-000000000001', '42501', null);
select * from tests.isolamento('categorias',            'aaaaaaaa-0000-4000-8000-000000000001', '42501', null);
select * from tests.isolamento('cartoes',               'aaaaaaaa-0000-4000-8000-000000000001', '42501', null);
select * from tests.isolamento('gastos',                'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
select * from tests.isolamento('receitas',              'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
select * from tests.isolamento('faturas_pagas',         'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
select * from tests.isolamento('dividas',               'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
-- Em pagamentos, o gatilho procura a dívida (com RLS) antes da política: 23503.
select * from tests.isolamento('dividas_pagamentos',    'aaaaaaaa-0000-4000-8000-000000000001', '23503', '23503');
select * from tests.isolamento('projetos',              'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
select * from tests.isolamento('projeto_gastos',        'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');
select * from tests.isolamento('aprendizado_categoria', 'aaaaaaaa-0000-4000-8000-000000000001', '42501', '23503');

-- Referências cruzadas específicas
select is(
  tests.estado(format(
    $$insert into public.gastos (valor_centavos, descricao, origem, cartao_id, tipo)
      values (1000, 'Teste', 'cartao', %L, 'necessario')$$,
    tests.ref('cartao_a')
  )),
  '23503',
  'gastos: não lança compra no cartão de outro usuário'
);
select is(
  tests.estado(format(
    'update public.gastos set categoria_id = %L where id = %L',
    tests.ref('categoria_a'), tests.ref('gasto_b')
  )),
  '23503',
  'gastos: não troca para a categoria de outro usuário'
);
select is(
  tests.estado(format(
    $$insert into public.faturas_pagas (cartao_id, mes_ref, conta_id) values (%L, '2026-11', %L)$$,
    tests.ref('cartao_b'), tests.ref('conta_a')
  )),
  '23503',
  'faturas_pagas: não paga fatura com a conta de outro usuário'
);
select is(
  tests.estado(format(
    $$insert into public.dividas (nome, valor_parcela_centavos, dia_vencimento, infinita, forma_pagamento, cartao_id)
      values ('Teste', 1000, 5, true, 'cartao', %L)$$,
    tests.ref('cartao_a')
  )),
  '23503',
  'dividas: não cadastra dívida no cartão de outro usuário'
);

-- RPCs não vazam dados
select results_eq(
  'select conta_id from public.saldo_contas()',
  format($$select %L::uuid$$, tests.ref('conta_b')),
  'saldo_contas: só a conta do próprio usuário'
);
select is_empty(
  format($$select * from public.fatura_cartao(%L, '2026-10')$$, tests.ref('cartao_a')),
  'fatura_cartao: cartão de outro usuário não retorna nada'
);
select is_empty(
  format($$select * from public.limite_cartao(%L)$$, tests.ref('cartao_a')),
  'limite_cartao: cartão de outro usuário não retorna nada'
);
select is(
  public.total_fatura(tests.ref('cartao_a'), '2026-10'),
  0::bigint,
  'total_fatura: cartão de outro usuário soma zero'
);
select is_empty(
  format($$select * from public.faturas_do_mes('2026-10') where cartao_id = %L$$, tests.ref('cartao_a')),
  'faturas_do_mes: não lista cartão de outro usuário'
);
select is_empty(
  format(
    $$select * from public.dividas_do_mes('2026-10') where divida_id in (%L, %L)$$,
    tests.ref('divida_a_conta'), tests.ref('divida_a_cartao')
  ),
  'dividas_do_mes: não lista dívida de outro usuário'
);
select is_empty(
  format($$select * from public.totais_projeto(%L)$$, tests.ref('projeto_a')),
  'totais_projeto: projeto de outro usuário não retorna nada'
);
select is(
  (select gastos_mes_centavos from public.resumo_mes('2026-10')),
  (select sum(valor_centavos)::bigint from public.gastos
    where data between '2026-10-01' and '2026-10-31' and deleted_at is null),
  'resumo_mes: soma só os gastos do próprio usuário'
);

-- Autenticado sem usuário no token não vê nada
select tests.entrar(null);
select is((select count(*) from public.gastos), 0::bigint, 'sem usuário no token: nenhuma linha');
reset role;

-- Visitante sem login
set local role anon;
select tests.entrar(null);
select * from tests.anon_sem_acesso();
reset role;

-- -----------------------------------------------------------------------------
-- A Ana continua intacta; apagar a conta apaga todos os dados dela
-- -----------------------------------------------------------------------------

select is(
  tests.contagem('aaaaaaaa-0000-4000-8000-000000000001'),
  (select dados from tests.fotos where chave = 'a'),
  'dados da Ana intactos depois das tentativas do Bruno'
);

select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'apagar o usuário no Auth funciona'
);
select is(
  (select sum(value::bigint) from jsonb_each_text(tests.contagem('aaaaaaaa-0000-4000-8000-000000000001'))),
  0::numeric,
  'apagar o usuário apaga todos os dados dele (cascata)'
);
select is(
  tests.contagem('bbbbbbbb-0000-4000-8000-000000000001'),
  (select dados from tests.fotos where chave = 'b'),
  'apagar um usuário não afeta os dados de outro'
);

select * from finish();
rollback;

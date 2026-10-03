-- =============================================================================
-- Finanças · 02 · Tabelas, constraints e índices
--
-- Isolamento entre usuários
--   Toda tabela tem user_id -> auth.users (on delete cascade). Toda referência a
--   outro registro do usuário (conta, cartão, categoria, dívida, projeto) usa
--   chave estrangeira COMPOSTA (registro_id, user_id) -> (id, user_id). Assim é
--   impossível uma linha apontar para dados de outro usuário, mesmo que alguém
--   descubra o id. Por isso as tabelas referenciadas têm unique (id, user_id).
-- =============================================================================

-- Perfis ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 80),
  meta_desnecessario_centavos bigint
    constraint profiles_meta_desnecessario_positiva check (meta_desnecessario_centavos > 0),
  tema public.tema_preferencia not null default 'sistema',
  ocultar_valores boolean not null default false,
  lembrete_diario boolean not null default true,
  mes_selecionado text
    constraint profiles_mes_selecionado_formato
    check (mes_selecionado ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  onboarding_concluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil e preferências do usuário (id = auth.uid()).';

-- Contas ---------------------------------------------------------------------

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null
    constraint contas_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  -- Único valor de saldo editado pelo usuário. Pode ser zero ou negativo.
  saldo_inicial_centavos bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contas_id_user_id_key unique (id, user_id)
);

create index contas_user_id_idx on public.contas (user_id);

-- Categorias -----------------------------------------------------------------

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null
    constraint categorias_nome_tamanho check (char_length(btrim(nome)) between 1 and 40),
  cor text not null default '#6B7280'
    constraint categorias_cor_hex check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categorias_id_user_id_key unique (id, user_id)
);

create unique index categorias_nome_unico on public.categorias (user_id, lower(btrim(nome)));

-- Cartões de crédito ---------------------------------------------------------

create table public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null
    constraint cartoes_nome_tamanho check (char_length(btrim(nome)) between 1 and 40),
  cor text not null default '#2E4A7A'
    constraint cartoes_cor_hex check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  limite_centavos bigint not null
    constraint cartoes_limite_positivo check (limite_centavos > 0),
  dia_fechamento int not null
    constraint cartoes_dia_fechamento_valido check (dia_fechamento between 1 and 31),
  dia_vencimento int not null
    constraint cartoes_dia_vencimento_valido check (dia_vencimento between 1 and 31),
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cartoes_id_user_id_key unique (id, user_id)
);

create index cartoes_user_id_idx on public.cartoes (user_id);

-- Gastos ---------------------------------------------------------------------

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Em compra parcelada, valor da PARCELA (o total é a soma do grupo).
  valor_centavos bigint not null
    constraint gastos_valor_positivo check (valor_centavos > 0),
  descricao text not null
    constraint gastos_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 120),
  data date not null default public.hoje(),
  origem public.origem_gasto not null,
  conta_id uuid,
  cartao_id uuid,
  categoria_id uuid,
  tipo public.tipo_gasto not null,
  parcela_atual int not null default 1,
  total_parcelas int not null default 1,
  grupo_parcelas uuid,
  -- Fatura (mês de fechamento) em que a compra no cartão entrou.
  -- Preenchido pelo gatilho gastos_preparar; o cliente não define.
  fatura_mes_ref text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gastos_parcelas_validas
    check (total_parcelas between 1 and 12 and parcela_atual between 1 and total_parcelas),
  constraint gastos_parcelado_tem_grupo
    check (total_parcelas = 1 or grupo_parcelas is not null),
  constraint gastos_parcelado_so_no_cartao
    check (origem = 'cartao' or total_parcelas = 1),
  constraint gastos_origem_coerente check (
    (origem = 'cartao' and cartao_id is not null and conta_id is null)
    or (origem <> 'cartao' and conta_id is not null and cartao_id is null)
  ),
  constraint gastos_fatura_coerente check (
    (origem = 'cartao') = (fatura_mes_ref is not null)
  ),
  constraint gastos_fatura_mes_ref_formato
    check (fatura_mes_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),

  constraint gastos_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id),
  constraint gastos_cartao_do_usuario foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id),
  constraint gastos_categoria_do_usuario foreign key (categoria_id, user_id)
    references public.categorias (id, user_id) on delete set null (categoria_id)
);

create index gastos_user_id_data_idx on public.gastos (user_id, data);
create index gastos_user_id_grupo_parcelas_idx on public.gastos (user_id, grupo_parcelas);
create index gastos_cartao_fatura_idx on public.gastos (cartao_id, fatura_mes_ref);
create index gastos_conta_id_idx on public.gastos (conta_id);
create index gastos_categoria_id_idx on public.gastos (categoria_id);
-- Uma parcela de cada número por grupo (ignorando as excluídas).
create unique index gastos_grupo_parcela_unica on public.gastos (grupo_parcelas, parcela_atual)
  where grupo_parcelas is not null and deleted_at is null;

-- Receitas -------------------------------------------------------------------

create table public.receitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  valor_centavos bigint not null
    constraint receitas_valor_positivo check (valor_centavos > 0),
  -- Origem da receita (ex.: "Salário", "Freela").
  descricao text not null
    constraint receitas_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 120),
  data date not null default public.hoje(),
  conta_id uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receitas_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id)
);

create index receitas_user_id_data_idx on public.receitas (user_id, data);
create index receitas_conta_id_idx on public.receitas (conta_id);

-- Faturas pagas --------------------------------------------------------------

create table public.faturas_pagas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id uuid not null,
  -- Mês em que a fatura fecha.
  mes_ref text not null
    constraint faturas_pagas_mes_ref_formato check (mes_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Conta de onde o dinheiro saiu.
  conta_id uuid not null,
  pago_em date not null default public.hoje(),
  created_at timestamptz not null default now(),
  constraint faturas_pagas_unica unique (user_id, cartao_id, mes_ref),
  constraint faturas_pagas_cartao_do_usuario foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id) on delete cascade,
  constraint faturas_pagas_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id)
);

create index faturas_pagas_user_id_mes_ref_idx on public.faturas_pagas (user_id, mes_ref);
create index faturas_pagas_cartao_id_idx on public.faturas_pagas (cartao_id, mes_ref);
create index faturas_pagas_conta_id_idx on public.faturas_pagas (conta_id);

-- Dívidas --------------------------------------------------------------------

create table public.dividas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null
    constraint dividas_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  tipo public.tipo_divida not null default 'outro',
  valor_parcela_centavos bigint not null
    constraint dividas_valor_positivo check (valor_parcela_centavos > 0),
  dia_vencimento int not null
    constraint dividas_dia_vencimento_valido check (dia_vencimento between 1 and 31),
  -- true = recorrente (sem fim); false = parcelada.
  infinita boolean not null default false,
  total_parcelas int,
  parcelas_ja_pagas int not null default 0,
  -- Mês de referência a partir do qual a contagem de parcelas é feita.
  mes_inicio_ref text not null default public.mes_atual()
    constraint dividas_mes_inicio_ref_formato
    check (mes_inicio_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  forma_pagamento public.forma_pagamento not null default 'conta',
  conta_id uuid,
  cartao_id uuid,
  ativa boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dividas_parcelas_validas check (
    (infinita and total_parcelas is null and parcelas_ja_pagas = 0)
    or (
      not infinita
      and total_parcelas between 1 and 600
      and parcelas_ja_pagas >= 0
      and parcelas_ja_pagas < total_parcelas
    )
  ),
  constraint dividas_forma_coerente check (
    (forma_pagamento = 'conta' and conta_id is not null and cartao_id is null)
    or (forma_pagamento = 'cartao' and cartao_id is not null and conta_id is null)
  ),
  constraint dividas_id_user_id_key unique (id, user_id),
  constraint dividas_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id),
  constraint dividas_cartao_do_usuario foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id)
);

create index dividas_user_id_idx on public.dividas (user_id);
create index dividas_conta_id_idx on public.dividas (conta_id);
create index dividas_cartao_id_idx on public.dividas (cartao_id);

-- Pagamentos de dívidas (um por dívida e mês) --------------------------------

create table public.dividas_pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  divida_id uuid not null,
  mes_ref text not null
    constraint dividas_pagamentos_mes_ref_formato
    check (mes_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pago_em date not null default public.hoje(),
  -- Retrato da dívida no momento do pagamento (preenchido pelo gatilho
  -- dividas_pagamentos_preparar). Assim, editar o valor da dívida só afeta as
  -- parcelas ainda não pagas, e mudar a forma de pagamento não reescreve o passado.
  valor_centavos bigint not null
    constraint dividas_pagamentos_valor_positivo check (valor_centavos > 0),
  forma_pagamento public.forma_pagamento not null,
  conta_id uuid,
  cartao_id uuid,
  -- Quando paga no cartão: fatura (mês de fechamento) em que o valor entra.
  fatura_mes_ref text
    constraint dividas_pagamentos_fatura_formato
    check (fatura_mes_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),

  constraint dividas_pagamentos_unico unique (divida_id, mes_ref),
  constraint dividas_pagamentos_forma_coerente check (
    (forma_pagamento = 'conta' and conta_id is not null and cartao_id is null and fatura_mes_ref is null)
    or (forma_pagamento = 'cartao' and cartao_id is not null and conta_id is null and fatura_mes_ref is not null)
  ),
  constraint dividas_pagamentos_divida_do_usuario foreign key (divida_id, user_id)
    references public.dividas (id, user_id) on delete cascade,
  constraint dividas_pagamentos_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id),
  constraint dividas_pagamentos_cartao_do_usuario foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id)
);

create index dividas_pagamentos_user_id_mes_ref_idx on public.dividas_pagamentos (user_id, mes_ref);
create index dividas_pagamentos_conta_id_idx on public.dividas_pagamentos (conta_id);
create index dividas_pagamentos_cartao_fatura_idx on public.dividas_pagamentos (cartao_id, fatura_mes_ref);

-- Metas de receita (uma por mês) --------------------------------------------

create table public.metas_receita (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mes_ref text not null
    constraint metas_receita_mes_ref_formato check (mes_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_meta_centavos bigint not null
    constraint metas_receita_valor_positivo check (valor_meta_centavos > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metas_receita_unica unique (user_id, mes_ref)
);

-- Projetos (isolados dos totais do mês) --------------------------------------

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null
    constraint projetos_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  orcamento_centavos bigint
    constraint projetos_orcamento_positivo check (orcamento_centavos > 0),
  descontar_do_saldo boolean not null default false,
  -- Conta de onde saem os gastos quando descontar_do_saldo está ligado.
  -- Se não informada, o gatilho projetos_preparar usa a conta principal.
  conta_id uuid,
  arquivado boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projetos_desconto_tem_conta check (not descontar_do_saldo or conta_id is not null),
  constraint projetos_id_user_id_key unique (id, user_id),
  constraint projetos_conta_do_usuario foreign key (conta_id, user_id)
    references public.contas (id, user_id)
);

create index projetos_user_id_idx on public.projetos (user_id);
create index projetos_conta_id_idx on public.projetos (conta_id);

create table public.projeto_gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  projeto_id uuid not null,
  descricao text not null
    constraint projeto_gastos_descricao_tamanho
    check (char_length(btrim(descricao)) between 1 and 120),
  valor_centavos bigint not null
    constraint projeto_gastos_valor_positivo check (valor_centavos > 0),
  data date not null default public.hoje(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projeto_gastos_projeto_do_usuario foreign key (projeto_id, user_id)
    references public.projetos (id, user_id) on delete cascade
);

create index projeto_gastos_user_id_data_idx on public.projeto_gastos (user_id, data);
create index projeto_gastos_projeto_id_idx on public.projeto_gastos (projeto_id);

-- Aprendizado de categoria (sugestões no formulário de gasto) -----------------

create table public.aprendizado_categoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Descrição normalizada (minúsculas, sem espaços duplicados). Ver gatilho.
  termo text not null
    constraint aprendizado_termo_tamanho check (char_length(termo) between 1 and 120),
  categoria_id uuid not null,
  tipo public.tipo_gasto not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aprendizado_categoria_termo_unico unique (user_id, termo),
  constraint aprendizado_categoria_do_usuario foreign key (categoria_id, user_id)
    references public.categorias (id, user_id) on delete cascade
);

create index aprendizado_categoria_categoria_id_idx on public.aprendizado_categoria (categoria_id);

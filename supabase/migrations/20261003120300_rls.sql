-- =============================================================================
-- Finanças · 04 · Row Level Security e permissões
--
-- * RLS ligado em TODAS as tabelas, com políticas de SELECT, INSERT, UPDATE e
--   DELETE restritas ao dono (user_id = auth.uid(), com WITH CHECK igual).
-- * O papel `anon` (visitante sem login) não tem acesso a nenhuma tabela.
-- * `authenticated` recebe só SELECT/INSERT/UPDATE/DELETE (sem TRUNCATE,
--   REFERENCES ou TRIGGER, que o Supabase concede por padrão).
-- * `(select auth.uid())` é avaliado uma vez por consulta (recomendação de
--   desempenho do Supabase para políticas RLS).
-- =============================================================================

-- Perfis: a chave do dono é a própria coluna id.
alter table public.profiles enable row level security;

create policy "profiles: dono lê" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: dono cria" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: dono altera" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: dono apaga" on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

-- Demais tabelas: a chave do dono é user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'contas', 'categorias', 'cartoes', 'gastos', 'receitas', 'faturas_pagas',
    'dividas', 'dividas_pagamentos', 'metas_receita', 'projetos', 'projeto_gastos',
    'aprendizado_categoria'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))',
      t || ': dono lê', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))',
      t || ': dono cria', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': dono altera', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))',
      t || ': dono apaga', t
    );

    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', t
    );
  end loop;
end;
$$;

-- Tabelas criadas no futuro neste schema não ficam abertas para `anon` por padrão.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;

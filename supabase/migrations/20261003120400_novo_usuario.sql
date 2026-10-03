-- =============================================================================
-- Finanças · 05 · Novo usuário
--
-- Ao criar um usuário no Auth: perfil, conta "Carteira" e categorias padrão.
-- security definer porque roda no contexto do serviço de Auth (sem auth.uid());
-- search_path vazio e nomes totalmente qualificados para não ser sequestrável.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    left(coalesce(btrim(new.raw_user_meta_data ->> 'nome'), ''), 80)
  );

  insert into public.contas (user_id, nome, saldo_inicial_centavos)
  values (new.id, 'Carteira', 0);

  insert into public.categorias (user_id, nome, cor)
  values
    (new.id, 'Alimentação', '#3C8D6A'),
    (new.id, 'Moradia', '#2E4A7A'),
    (new.id, 'Transporte', '#4F7CAC'),
    (new.id, 'Lazer', '#C98F2E'),
    (new.id, 'Compras', '#C65468'),
    (new.id, 'Saúde', '#3F8F8F'),
    (new.id, 'Educação', '#6F5AA8'),
    (new.id, 'Assinaturas', '#8A6A3F'),
    (new.id, 'Outros', '#6B7280');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists financas_ao_criar_usuario on auth.users;
create trigger financas_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.handle_new_user();

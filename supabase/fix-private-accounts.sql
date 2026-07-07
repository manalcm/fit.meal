-- fitmeal - ajuste para cuentas privadas vacias
-- Ejecutar en Supabase SQL Editor si ya corriste add-auth-households.sql antes.

create or replace function public.create_household_for_current_user(household_name text default 'Mi cuenta')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion.';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (
    coalesce(nullif(trim(household_name), ''), 'Mi cuenta'),
    upper(left(md5(random()::text), 10)),
    auth.uid()
  )
  returning * into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household.id, auth.uid(), 'owner');

  return new_household;
end;
$$;

revoke all on function public.create_household_for_current_user(text) from public, anon;
grant execute on function public.create_household_for_current_user(text) to authenticated;

-- fitmeal - cuentas, hogares compartidos y politicas RLS por hogar
-- Ejecutar una vez en Supabase > SQL Editor antes de desplegar esta version.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi hogar',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

insert into public.households (id, name)
values ('00000000-0000-0000-0000-000000000001', 'fitmeal')
on conflict (id) do nothing;

alter table public.ingredients add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.meals add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.meal_ingredients add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.people add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.plan_entries add column if not exists household_id uuid references public.households(id) on delete cascade;

update public.ingredients set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.meals set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.meal_ingredients mi
set household_id = coalesce(m.household_id, '00000000-0000-0000-0000-000000000001')
from public.meals m
where mi.meal_id = m.id and mi.household_id is null;
update public.people set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.plan_entries pe
set household_id = coalesce(p.household_id, '00000000-0000-0000-0000-000000000001')
from public.people p
where pe.person_id = p.id and pe.household_id is null;

alter table public.ingredients alter column household_id set not null;
alter table public.meals alter column household_id set not null;
alter table public.meal_ingredients alter column household_id set not null;
alter table public.people alter column household_id set not null;
alter table public.plan_entries alter column household_id set not null;

alter table public.ingredients drop constraint if exists ingredients_name_key;
create unique index if not exists ingredients_household_name_idx
  on public.ingredients (household_id, lower(name));

create index if not exists meals_household_idx on public.meals(household_id);
create index if not exists meal_ingredients_household_idx on public.meal_ingredients(household_id);
create index if not exists people_household_idx on public.people(household_id);
create index if not exists plan_entries_household_date_idx on public.plan_entries(household_id, date);
create index if not exists household_members_user_idx on public.household_members(user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ingredients enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.people enable row level security;
alter table public.plan_entries enable row level security;

drop policy if exists "app_full_access" on public.ingredients;
drop policy if exists "app_full_access" on public.meals;
drop policy if exists "app_full_access" on public.meal_ingredients;
drop policy if exists "app_full_access" on public.people;
drop policy if exists "app_full_access" on public.plan_entries;

drop policy if exists "members_select_households" on public.households;
drop policy if exists "owners_update_households" on public.households;
drop policy if exists "members_select_own_membership" on public.household_members;
drop policy if exists "members_manage_ingredients" on public.ingredients;
drop policy if exists "members_manage_meals" on public.meals;
drop policy if exists "members_manage_meal_ingredients" on public.meal_ingredients;
drop policy if exists "members_manage_people" on public.people;
drop policy if exists "members_manage_plan_entries" on public.plan_entries;

create policy "members_select_households"
on public.households for select
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = (select auth.uid())
  )
);

create policy "owners_update_households"
on public.households for update
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
  )
);

create policy "members_select_own_membership"
on public.household_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members_manage_ingredients"
on public.ingredients for all
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = ingredients.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = ingredients.household_id
      and hm.user_id = (select auth.uid())
  )
);

create policy "members_manage_meals"
on public.meals for all
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = meals.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = meals.household_id
      and hm.user_id = (select auth.uid())
  )
);

create policy "members_manage_meal_ingredients"
on public.meal_ingredients for all
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = meal_ingredients.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = meal_ingredients.household_id
      and hm.user_id = (select auth.uid())
  )
);

create policy "members_manage_people"
on public.people for all
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = people.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = people.household_id
      and hm.user_id = (select auth.uid())
  )
);

create policy "members_manage_plan_entries"
on public.plan_entries for all
to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = plan_entries.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = plan_entries.household_id
      and hm.user_id = (select auth.uid())
  )
);

create or replace function public.create_household_for_current_user(household_name text default 'Mi hogar')
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

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Mi hogar'), auth.uid())
  returning * into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household.id, auth.uid(), 'owner');

  insert into public.people (household_id, name, color, target_kcal, target_protein, target_carbs, target_fat, target_water_ml)
  values
    (new_household.id, 'Persona 1', '#C1613A', 2200, 140, 220, 70, 2500),
    (new_household.id, 'Persona 2', '#7E9468', 1800, 110, 180, 55, 2000);

  return new_household;
end;
$$;

create or replace function public.join_household_by_code(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion.';
  end if;

  select *
  into target_household
  from public.households
  where invite_code = upper(trim(code))
  limit 1;

  if target_household.id is null then
    raise exception 'Codigo de invitacion no valido.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_household.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return target_household;
end;
$$;

create or replace function public.claim_existing_fitmeal_household()
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_household public.households;
  member_count integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion.';
  end if;

  select *
  into legacy_household
  from public.households
  where id = '00000000-0000-0000-0000-000000000001';

  select count(*)
  into member_count
  from public.household_members
  where household_id = legacy_household.id;

  if member_count = 0 then
    update public.households
    set created_by = auth.uid()
    where id = legacy_household.id;

    insert into public.household_members (household_id, user_id, role)
    values (legacy_household.id, auth.uid(), 'owner');

    select * into legacy_household
    from public.households
    where id = '00000000-0000-0000-0000-000000000001';

    return legacy_household;
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = legacy_household.id
      and user_id = auth.uid()
  ) then
    return legacy_household;
  end if;

  raise exception 'Este hogar ya fue reclamado. Pide el codigo de invitacion.';
end;
$$;

revoke all on function public.create_household_for_current_user(text) from public, anon;
revoke all on function public.join_household_by_code(text) from public, anon;
revoke all on function public.claim_existing_fitmeal_household() from public, anon;
grant execute on function public.create_household_for_current_user(text) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;
grant execute on function public.claim_existing_fitmeal_household() to authenticated;

revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.ingredients from anon;
revoke all on public.meals from anon;
revoke all on public.meal_ingredients from anon;
revoke all on public.people from anon;
revoke all on public.plan_entries from anon;

grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.ingredients to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_ingredients to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.plan_entries to authenticated;

drop policy if exists "meal_photos_write" on storage.objects;
drop policy if exists "meal_photos_update" on storage.objects;
drop policy if exists "meal_photos_delete" on storage.objects;

create policy "meal_photos_write"
on storage.objects for insert
to authenticated
with check (bucket_id = 'meal-photos');

create policy "meal_photos_update"
on storage.objects for update
to authenticated
using (bucket_id = 'meal-photos')
with check (bucket_id = 'meal-photos');

create policy "meal_photos_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'meal-photos');

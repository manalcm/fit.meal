begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.ingredients
  add column if not exists package_price numeric,
  add column if not exists package_size numeric,
  add column if not exists package_unit public.ingredient_unit;

update public.ingredients
set package_unit = default_unit
where package_size is not null
  and package_unit is null;

alter table public.households
  add column if not exists weekly_budget numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_package_price_positive'
  ) then
    alter table public.ingredients
      add constraint ingredients_package_price_positive
      check (package_price is null or package_price > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_package_size_positive'
  ) then
    alter table public.ingredients
      add constraint ingredients_package_size_positive
      check (package_size is null or package_size > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.households'::regclass
      and conname = 'households_weekly_budget_nonnegative'
  ) then
    alter table public.households
      add constraint households_weekly_budget_nonnegative
      check (weekly_budget is null or weekly_budget >= 0)
      not valid;
  end if;
end
$$;

commit;

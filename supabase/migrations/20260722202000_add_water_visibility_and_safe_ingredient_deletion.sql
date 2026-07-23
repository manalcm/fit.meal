begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.people
  add column if not exists show_water_tracking boolean not null default true;

comment on column public.people.show_water_tracking is
  'Controls whether the water tracker is shown for this person. Existing water data is retained.';

create or replace function public.delete_unused_ingredients(p_ingredient_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  requested_ids uuid[] := coalesce(p_ingredient_ids, array[]::uuid[]);
  deleted_ids uuid[] := array[]::uuid[];
  blocked jsonb := '[]'::jsonb;
begin
  if cardinality(requested_ids) = 0 then
    return jsonb_build_object(
      'deleted_ids', to_jsonb(deleted_ids),
      'blocked', blocked
    );
  end if;

  -- The invoker's RLS policies decide which ingredients, meal lines and meals
  -- are visible and deletable. Used ingredients are never touched.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ingredient_id', used.ingredient_id,
        'meal_names', used.meal_names
      )
      order by used.ingredient_id
    ),
    '[]'::jsonb
  )
  into blocked
  from (
    select
      usage.ingredient_id,
      to_jsonb(array_agg(distinct usage.reference_name order by usage.reference_name)) as meal_names
    from (
      select mi.ingredient_id, m.name as reference_name
      from public.meal_ingredients mi
      join public.meals m on m.id = mi.meal_id
      where mi.ingredient_id = any(requested_ids)

      union all

      select pe.ingredient_id, 'Planificación como alimento suelto' as reference_name
      from public.plan_entries pe
      where pe.entry_kind = 'loose_ingredient'
        and pe.ingredient_id = any(requested_ids)
    ) usage
    group by usage.ingredient_id
  ) used;

  with candidates as (
    select i.id
    from public.ingredients i
    where i.id = any(requested_ids)
      and not exists (
        select 1
        from public.meal_ingredients mi
        where mi.ingredient_id = i.id
      )
      and not exists (
        select 1
        from public.plan_entries pe
        where pe.ingredient_id = i.id
      )
    for update
  ), deleted as (
    delete from public.ingredients i
    using candidates c
    where i.id = c.id
    returning i.id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into deleted_ids
  from deleted;

  return jsonb_build_object(
    'deleted_ids', to_jsonb(deleted_ids),
    'blocked', blocked
  );
end
$$;

revoke all on function public.delete_unused_ingredients(uuid[]) from public;
revoke all on function public.delete_unused_ingredients(uuid[]) from anon;
grant execute on function public.delete_unused_ingredients(uuid[]) to authenticated;

commit;

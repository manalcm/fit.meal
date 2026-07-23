begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.add_surprise_plan_items(
  p_meal_id uuid,
  p_date date,
  p_meal_type public.meal_type,
  p_assignments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_household_id uuid;
  assignment_row record;
  created_rows jsonb := '[]'::jsonb;
  skipped_people jsonb := '[]'::jsonb;
  selected_person_name text;
  created_entry_id uuid;
begin
  if p_assignments is null
     or jsonb_typeof(p_assignments) <> 'array'
     or jsonb_array_length(p_assignments) = 0 then
    raise exception 'No hay personas con una franja disponible.';
  end if;

  select m.household_id
  into target_household_id
  from public.meals m
  where m.id = p_meal_id
    and p_meal_type = any(m.meal_types);

  if target_household_id is null then
    raise exception 'El plato no pertenece a esta franja o a este hogar.';
  end if;

  if (
    select count(*)
    from (
      select distinct (item.value ->> 'person_id')::uuid
      from jsonb_array_elements(p_assignments) as item(value)
    ) unique_people
  ) <> jsonb_array_length(p_assignments) then
    raise exception 'No se puede planificar dos veces para la misma persona.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    left join public.people p
      on p.id = (item.value ->> 'person_id')::uuid
     and p.household_id = target_household_id
    where p.id is null
       or (item.value ->> 'servings')::numeric not in (0.5, 1)
  ) then
    raise exception 'La propuesta contiene una persona o una cantidad no válida.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(target_household_id::text || ':' || p_date::text || ':' || p_meal_type::text)
  );

  for assignment_row in
    select
      (item.value ->> 'person_id')::uuid as person_id,
      (item.value ->> 'servings')::numeric as servings
    from jsonb_array_elements(p_assignments) as item(value)
    order by (item.value ->> 'person_id')::uuid
  loop
    select p.name
    into selected_person_name
    from public.people p
    where p.id = assignment_row.person_id
      and p.household_id = target_household_id;

    if exists (
      select 1
      from public.plan_entries pe
      where pe.person_id = assignment_row.person_id
        and pe.date = p_date
        and pe.meal_type = p_meal_type
    ) then
      skipped_people := skipped_people || jsonb_build_array(
        jsonb_build_object(
          'person_id', assignment_row.person_id,
          'name', selected_person_name
        )
      );
      continue;
    end if;

    insert into public.plan_entries (
      household_id,
      person_id,
      date,
      meal_type,
      entry_kind,
      meal_id,
      planned_servings,
      portion,
      override_grams
    )
    values (
      target_household_id,
      assignment_row.person_id,
      p_date,
      p_meal_type,
      'meal',
      p_meal_id,
      assignment_row.servings,
      assignment_row.servings,
      null
    )
    returning id into created_entry_id;

    created_rows := created_rows || jsonb_build_array(
      jsonb_build_object(
        'id', created_entry_id,
        'person_id', assignment_row.person_id
      )
    );
  end loop;

  return jsonb_build_object(
    'created', created_rows,
    'skipped', skipped_people
  );
end
$$;

revoke all on function public.add_surprise_plan_items(
  uuid,
  date,
  public.meal_type,
  jsonb
) from public, anon;

grant execute on function public.add_surprise_plan_items(
  uuid,
  date,
  public.meal_type,
  jsonb
) to authenticated;

commit;

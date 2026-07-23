begin;

set local lock_timeout = '5s';

alter table public.plan_entries
  add column if not exists entry_kind text not null default 'meal',
  add column if not exists ingredient_id uuid,
  add column if not exists exact_quantity numeric,
  add column if not exists exact_unit public.ingredient_unit;

alter table public.plan_entries
  alter column meal_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.plan_entries'::regclass
      and conname = 'plan_entries_ingredient_id_fkey'
  ) then
    alter table public.plan_entries
      add constraint plan_entries_ingredient_id_fkey
      foreign key (ingredient_id)
      references public.ingredients(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists plan_entries_ingredient_id_idx
  on public.plan_entries(ingredient_id)
  where ingredient_id is not null;

-- Used by every occupied-slot check, family copy and eating-out replacement.
create index if not exists plan_entries_person_date_meal_type_idx
  on public.plan_entries(person_id, date, meal_type);

-- Replace the former portion/override XOR constraint with a constraint that
-- also permits loose ingredients and the eating-out state.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.plan_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%portion%'
      and pg_get_constraintdef(oid) ilike '%override_grams%'
  loop
    execute format(
      'alter table public.plan_entries drop constraint %I',
      constraint_row.conname
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.plan_entries'::regclass
      and conname = 'plan_entries_kind_shape'
  ) then
    alter table public.plan_entries
      add constraint plan_entries_kind_shape
      check (
        (
          entry_kind = 'meal'
          and meal_id is not null
          and ingredient_id is null
          and exact_quantity is null
          and exact_unit is null
          and (
            (
              planned_servings is not null
              and portion = planned_servings
              and override_grams is null
            )
            or (
              planned_servings is null
              and (
                (portion is not null and portion > 0 and override_grams is null)
                or (portion is null and override_grams is not null and override_grams > 0)
              )
            )
          )
        )
        or (
          entry_kind = 'loose_ingredient'
          and meal_id is null
          and ingredient_id is not null
          and exact_quantity is not null
          and exact_quantity > 0
          and exact_unit is not null
          and planned_servings is null
          and portion is null
          and override_grams is null
          and legacy_snapshot is null
        )
        or (
          entry_kind = 'eating_out'
          and meal_id is null
          and ingredient_id is null
          and exact_quantity is null
          and exact_unit is null
          and planned_servings is null
          and portion is null
          and override_grams is null
          and legacy_snapshot is null
        )
      );
  end if;
end
$$;

create or replace function public.validate_plan_entry_unit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  configured_unit public.ingredient_unit;
begin
  if new.entry_kind = 'loose_ingredient' then
    select i.default_unit
    into configured_unit
    from public.ingredients i
    where i.id = new.ingredient_id
      and i.household_id = new.household_id;

    if configured_unit is null then
      raise exception 'El ingrediente no pertenece a este hogar.';
    end if;

    if new.exact_unit is distinct from configured_unit then
      raise exception 'La unidad no coincide con la configurada para el ingrediente.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists validate_plan_entry_unit_trigger on public.plan_entries;
create trigger validate_plan_entry_unit_trigger
before insert or update of entry_kind, ingredient_id, exact_unit, household_id
on public.plan_entries
for each row
execute function public.validate_plan_entry_unit();

create or replace function public.enforce_eating_out_exclusivity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.person_id::text || ':' || new.date::text || ':' || new.meal_type::text)
  );

  if new.entry_kind = 'eating_out' then
    if exists (
      select 1
      from public.plan_entries pe
      where pe.person_id = new.person_id
        and pe.date = new.date
        and pe.meal_type = new.meal_type
        and pe.id <> new.id
    ) then
      raise exception 'Esta franja ya contiene una planificación.';
    end if;
  elsif exists (
    select 1
    from public.plan_entries pe
    where pe.person_id = new.person_id
      and pe.date = new.date
      and pe.meal_type = new.meal_type
      and pe.entry_kind = 'eating_out'
      and pe.id <> new.id
  ) then
    raise exception 'La franja está marcada como Comemos fuera.';
  end if;

  return new;
end
$$;

drop trigger if exists enforce_eating_out_exclusivity_trigger on public.plan_entries;
create trigger enforce_eating_out_exclusivity_trigger
before insert or update of person_id, date, meal_type, entry_kind
on public.plan_entries
for each row
execute function public.enforce_eating_out_exclusivity();

create or replace function public.add_plan_item_with_household_copies(
  p_source_person_id uuid,
  p_date date,
  p_meal_type public.meal_type,
  p_entry_kind text,
  p_meal_id uuid,
  p_ingredient_id uuid,
  p_exact_quantity numeric,
  p_exact_unit public.ingredient_unit,
  p_planned_servings numeric,
  p_copy_to_household boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_household_id uuid;
  source_entry_id uuid;
  copy_entry_id uuid;
  copy_entry_ids uuid[] := array[]::uuid[];
  copied_person_ids uuid[] := array[]::uuid[];
  skipped_people jsonb := '[]'::jsonb;
  household_person record;
begin
  select p.household_id
  into target_household_id
  from public.people p
  where p.id = p_source_person_id;

  if target_household_id is null then
    raise exception 'No se ha encontrado la persona seleccionada.';
  end if;

  if p_entry_kind not in ('meal', 'loose_ingredient') then
    raise exception 'Tipo de planificación no válido.';
  end if;

  if p_entry_kind = 'meal' and not exists (
    select 1
    from public.meals m
    where m.id = p_meal_id
      and m.household_id = target_household_id
  ) then
    raise exception 'El plato no pertenece a este hogar.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(target_household_id::text || ':' || p_date::text || ':' || p_meal_type::text)
  );

  insert into public.plan_entries (
    household_id,
    person_id,
    date,
    meal_type,
    entry_kind,
    meal_id,
    ingredient_id,
    exact_quantity,
    exact_unit,
    planned_servings,
    portion,
    override_grams
  )
  values (
    target_household_id,
    p_source_person_id,
    p_date,
    p_meal_type,
    p_entry_kind,
    case when p_entry_kind = 'meal' then p_meal_id else null end,
    case when p_entry_kind = 'loose_ingredient' then p_ingredient_id else null end,
    case when p_entry_kind = 'loose_ingredient' then p_exact_quantity else null end,
    case when p_entry_kind = 'loose_ingredient' then p_exact_unit else null end,
    case when p_entry_kind = 'meal' then p_planned_servings else null end,
    case when p_entry_kind = 'meal' then p_planned_servings else null end,
    null
  )
  returning id into source_entry_id;

  if p_copy_to_household then
    for household_person in
      select p.id, p.name
      from public.people p
      where p.household_id = target_household_id
        and p.id <> p_source_person_id
      order by p.created_at, p.id
    loop
      if exists (
        select 1
        from public.plan_entries pe
        where pe.person_id = household_person.id
          and pe.date = p_date
          and pe.meal_type = p_meal_type
      ) then
        skipped_people := skipped_people || jsonb_build_array(
          jsonb_build_object('person_id', household_person.id, 'name', household_person.name)
        );
      else
        insert into public.plan_entries (
          household_id,
          person_id,
          date,
          meal_type,
          entry_kind,
          meal_id,
          ingredient_id,
          exact_quantity,
          exact_unit,
          planned_servings,
          portion,
          override_grams
        )
        values (
          target_household_id,
          household_person.id,
          p_date,
          p_meal_type,
          p_entry_kind,
          case when p_entry_kind = 'meal' then p_meal_id else null end,
          case when p_entry_kind = 'loose_ingredient' then p_ingredient_id else null end,
          case when p_entry_kind = 'loose_ingredient' then p_exact_quantity else null end,
          case when p_entry_kind = 'loose_ingredient' then p_exact_unit else null end,
          case when p_entry_kind = 'meal' then p_planned_servings else null end,
          case when p_entry_kind = 'meal' then p_planned_servings else null end,
          null
        )
        returning id into copy_entry_id;

        copy_entry_ids := array_append(copy_entry_ids, copy_entry_id);
        copied_person_ids := array_append(copied_person_ids, household_person.id);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'source_id', source_entry_id,

    'copy_ids', to_jsonb(copy_entry_ids),
    'copied_person_ids', to_jsonb(copied_person_ids),
    'skipped', skipped_people
  );
end
$$;

create or replace function public.set_eating_out_for_people(
  p_person_ids uuid[],
  p_date date,
  p_meal_type public.meal_type,
  p_replace_existing boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_household_id uuid;
  expected_people integer;
  visible_people integer;
  person_id_value uuid;
  created_entry_id uuid;
  created_entry_ids uuid[] := array[]::uuid[];
begin
  if p_person_ids is null or cardinality(p_person_ids) = 0 then
    raise exception 'Selecciona al menos una persona.';
  end if;

  if array_position(p_person_ids, null) is not null then
    raise exception 'La selección contiene una persona no válida.';
  end if;

  select count(distinct selected_id)
  into expected_people
  from unnest(p_person_ids) as selected(selected_id);

  select p.household_id
  into target_household_id
  from public.people p
  where p.id = p_person_ids[1];

  if target_household_id is null then
    raise exception 'No se ha encontrado la persona seleccionada.';
  end if;

  select count(*)
  into visible_people
  from public.people p
  where p.household_id = target_household_id
    and p.id = any(p_person_ids);

  if visible_people <> expected_people then
    raise exception 'Todas las personas deben pertenecer al mismo hogar.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(target_household_id::text || ':' || p_date::text || ':' || p_meal_type::text)
  );

  if not p_replace_existing and exists (
    select 1
    from public.plan_entries pe
    where pe.person_id = any(p_person_ids)
      and pe.date = p_date
      and pe.meal_type = p_meal_type
  ) then
    raise exception 'Alguna de las franjas seleccionadas ya contiene una planificación.';
  end if;

  for person_id_value in
    select distinct selected_id
    from unnest(p_person_ids) as selected(selected_id)
  loop
    if p_replace_existing then
      delete from public.plan_entries pe
      where pe.person_id = person_id_value
        and pe.date = p_date
        and pe.meal_type = p_meal_type;
    end if;

    insert into public.plan_entries (
      household_id,
      person_id,
      date,
      meal_type,
      entry_kind
    )
    values (
      target_household_id,
      person_id_value,
      p_date,
      p_meal_type,
      'eating_out'
    )
    returning id into created_entry_id;

    created_entry_ids := array_append(created_entry_ids, created_entry_id);
  end loop;

  return jsonb_build_object('created_ids', to_jsonb(created_entry_ids));
end
$$;

revoke all on function public.add_plan_item_with_household_copies(
  uuid,
  date,
  public.meal_type,
  text,
  uuid,
  uuid,
  numeric,
  public.ingredient_unit,
  numeric,
  boolean
) from public, anon;
grant execute on function public.add_plan_item_with_household_copies(
  uuid,
  date,
  public.meal_type,
  text,
  uuid,
  uuid,
  numeric,
  public.ingredient_unit,
  numeric,
  boolean
) to authenticated;

revoke all on function public.set_eating_out_for_people(
  uuid[],
  date,
  public.meal_type,
  boolean
) from public, anon;
grant execute on function public.set_eating_out_for_people(
  uuid[],
  date,
  public.meal_type,
  boolean
) to authenticated;

commit;

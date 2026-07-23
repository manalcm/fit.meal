-- Read-only preflight. Run before 20260722202000_add_water_visibility_and_safe_ingredient_deletion.sql.
select
  (select count(*) from public.people) as people_that_will_start_with_water_visible,
  (select count(*) from public.ingredients) as total_ingredients,
  (
    select count(distinct mi.ingredient_id)
    from public.meal_ingredients mi
  ) as ingredients_used_in_meals,
  (
    select count(distinct pe.ingredient_id)
    from public.plan_entries pe
    where pe.entry_kind = 'loose_ingredient'
  ) as ingredients_used_in_loose_plans,
  (
    select count(*)
    from public.ingredients i
    where not exists (
      select 1 from public.meal_ingredients mi where mi.ingredient_id = i.id
    )
      and not exists (
        select 1 from public.plan_entries pe where pe.ingredient_id = i.id
      )
  ) as ingredients_currently_safe_to_delete;

begin;

set local lock_timeout = '5s';

alter table public.meals
  add column if not exists recipe_servings numeric;

update public.meals
set recipe_servings = 1
where recipe_servings is null;

alter table public.meals
  alter column recipe_servings set default 1,
  alter column recipe_servings set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.meals'::regclass
      and conname = 'meals_recipe_servings_positive'
  ) then
    alter table public.meals
      add constraint meals_recipe_servings_positive
      check (recipe_servings > 0);
  end if;
end
$$;

alter table public.plan_entries
  add column if not exists planned_servings numeric,
  add column if not exists legacy_snapshot jsonb;

-- Preserve the exact calculation inputs and outputs before converting any row.
-- This snapshot is also used by legacy gram entries after a recipe is edited.
with meal_totals as (
  select
    m.id as meal_id,
    m.name as meal_name,
    coalesce(sum(mi.quantity_grams), 0)::numeric as base_quantity,
    coalesce(sum(mi.quantity_grams * i.kcal_per_100g / 100), 0)::numeric as kcal,
    coalesce(sum(mi.quantity_grams * i.protein_per_100g / 100), 0)::numeric as protein,
    coalesce(sum(mi.quantity_grams * i.carbs_per_100g / 100), 0)::numeric as carbs,
    coalesce(sum(mi.quantity_grams * i.fat_per_100g / 100), 0)::numeric as fat,
    coalesce(sum(mi.quantity_grams * coalesce(i.price_per_kg, 0) / 1000), 0)::numeric as cost
  from public.meals m
  left join public.meal_ingredients mi on mi.meal_id = m.id
  left join public.ingredients i on i.id = mi.ingredient_id
  group by m.id, m.name
), candidates as (
  select
    pe.id,
    pe.meal_id,
    mt.meal_name,
    pe.portion,
    pe.override_grams,
    mt.base_quantity,
    mt.kcal,
    mt.protein,
    mt.carbs,
    mt.fat,
    mt.cost,
    case
      when pe.portion is not null then pe.portion
      when pe.override_grams is not null and mt.base_quantity > 0
        then pe.override_grams / mt.base_quantity
      else null
    end as factor
  from public.plan_entries pe
  join meal_totals mt on mt.meal_id = pe.meal_id
  where pe.override_grams is not null
     or (
       pe.portion is not null
       and abs(pe.portion * 2 - round(pe.portion * 2)) > 0.000000001
     )
)
update public.plan_entries pe
set legacy_snapshot = jsonb_build_object(
  'version', 1,
  'source_mode', case when c.override_grams is not null then 'grams' else 'portion' end,
  'meal_name', c.meal_name,
  'original_portion', c.portion,
  'original_override_grams', c.override_grams,
  'factor', c.factor,
  'totals', jsonb_build_object(
    'kcal', c.kcal * coalesce(c.factor, 0),
    'protein', c.protein * coalesce(c.factor, 0),
    'carbs', c.carbs * coalesce(c.factor, 0),
    'fat', c.fat * coalesce(c.factor, 0),
    'cost', c.cost * coalesce(c.factor, 0)
  ),
  'ingredients', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'ingredient_id', mi.ingredient_id,
        'quantity_grams', mi.quantity_grams * coalesce(c.factor, 0)
      )
      order by mi.ingredient_id
    )
    from public.meal_ingredients mi
    where mi.meal_id = c.meal_id
  ), '[]'::jsonb)
)
from candidates c
where pe.id = c.id
  and pe.legacy_snapshot is null;

-- Existing portion-based rows keep the same numerical factor because every
-- existing recipe initially produces one serving.
update public.plan_entries
set planned_servings = round(portion * 2) / 2
where planned_servings is null
  and portion is not null
  and portion > 0
  and abs(portion * 2 - round(portion * 2)) <= 0.000000001;

-- Exact-gram rows are converted only when their equivalent is a valid half
-- serving. The original gram value remains preserved in legacy_snapshot.
with bases as (
  select meal_id, sum(quantity_grams)::numeric as base_quantity
  from public.meal_ingredients
  group by meal_id
), convertible as (
  select
    pe.id,
    round((pe.override_grams / b.base_quantity) * 2) / 2 as servings
  from public.plan_entries pe
  join bases b on b.meal_id = pe.meal_id
  where pe.planned_servings is null
    and pe.override_grams is not null
    and pe.override_grams > 0
    and b.base_quantity > 0
    and abs(
      (pe.override_grams / b.base_quantity) * 2
      - round((pe.override_grams / b.base_quantity) * 2)
    ) <= 0.000000001
)
update public.plan_entries pe
set
  planned_servings = c.servings,
  portion = c.servings,
  override_grams = null
from convertible c
where pe.id = c.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.plan_entries'::regclass
      and conname = 'plan_entries_planned_servings_half_step'
  ) then
    alter table public.plan_entries
      add constraint plan_entries_planned_servings_half_step
      check (
        planned_servings is null
        or (
          planned_servings >= 0.5
          and planned_servings * 2 = trunc(planned_servings * 2)
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.plan_entries'::regclass
      and conname = 'plan_entries_portion_matches_servings'
  ) then
    alter table public.plan_entries
      add constraint plan_entries_portion_matches_servings
      check (planned_servings is null or portion = planned_servings);
  end if;
end
$$;

commit;

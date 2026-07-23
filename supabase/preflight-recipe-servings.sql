-- Read-only report. Run this before applying the recipe-servings migration.
with meal_bases as (
  select meal_id, sum(quantity_grams)::numeric as base_quantity
  from public.meal_ingredients
  group by meal_id
), classified as (
  select
    pe.id,
    pe.portion,
    pe.override_grams,
    mb.base_quantity,
    case
      when pe.portion is not null
        and pe.portion > 0
        and abs(pe.portion * 2 - round(pe.portion * 2)) <= 0.000000001
        then 'convertible_portion'
      when pe.override_grams is not null
        and pe.override_grams > 0
        and mb.base_quantity > 0
        and abs(
          (pe.override_grams / mb.base_quantity) * 2
          - round((pe.override_grams / mb.base_quantity) * 2)
        ) <= 0.000000001
        then 'convertible_grams'
      else 'legacy'
    end as classification
  from public.plan_entries pe
  left join meal_bases mb on mb.meal_id = pe.meal_id
)
select
  (select count(*) from public.meals) as meals,
  count(*) as plan_entries,
  count(*) filter (where portion is not null) as current_portion_entries,
  count(*) filter (where override_grams is not null) as current_exact_gram_entries,
  count(*) filter (where classification = 'convertible_portion') as convertible_portion_entries,
  count(*) filter (where classification = 'convertible_grams') as convertible_exact_gram_entries,
  count(*) filter (where classification = 'legacy') as entries_remaining_legacy
from classified;

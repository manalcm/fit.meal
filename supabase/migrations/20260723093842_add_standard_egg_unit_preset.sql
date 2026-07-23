begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Se añade como un ingrediente nuevo para no modificar el huevo por gramos
-- que ya pudiera estar presente en ninguna casa.
insert into public.ingredients (
  household_id, name, category,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  nutrition_unit, default_unit, grams_per_unit,
  price_per_kg, package_price, package_size, package_unit, in_pantry
)
select
  h.id, 'Huevo de gallina (unidad mediana)', 'huevo',
  70, 6.3, 0.4, 4.8,
  'unidad', 'unidad', 50,
  null, null, 12, 'unidad', false
from public.households h
where not exists (
  select 1
  from public.ingredients i
  where i.household_id = h.id
    and lower(i.name) = lower('Huevo de gallina (unidad mediana)')
);

commit;

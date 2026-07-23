begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Los valores existentes se conservan como estaban: por 100 g. La nueva
-- unidad solo describe cómo deben leerse los valores que se creen a partir de
-- ahora; no recalcula ni altera ningún ingrediente anterior.
alter table public.ingredients
  add column if not exists nutrition_unit public.ingredient_unit not null default 'gramos';

-- quantity_grams queda como columna de compatibilidad para no romper platos
-- ni instantáneas históricas. Los nuevos campos conservan la unidad real con
-- la que se añade un ingrediente a una receta.
alter table public.meal_ingredients
  add column if not exists quantity numeric,
  add column if not exists unit public.ingredient_unit;

update public.meal_ingredients
set quantity = quantity_grams,
    unit = 'gramos'
where quantity is null or unit is null;

-- Los líquidos ya existentes se interpretaban en pantalla y en cálculos como
-- mililitros. Conservamos exactamente sus valores numéricos y solo hacemos
-- explícita esa unidad para las recetas históricas.
update public.ingredients
set nutrition_unit = 'ml'
where default_unit = 'ml';

update public.meal_ingredients mi
set unit = 'ml'
from public.ingredients i
where mi.ingredient_id = i.id
  and i.default_unit = 'ml';

alter table public.meal_ingredients
  alter column quantity set not null,
  alter column unit set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.meal_ingredients'::regclass
      and conname = 'meal_ingredients_quantity_positive'
  ) then
    alter table public.meal_ingredients
      add constraint meal_ingredients_quantity_positive
      check (quantity > 0) not valid;
  end if;
end $$;

commit;

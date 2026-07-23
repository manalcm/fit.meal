select
  count(*) as ingredients,
  count(*) filter (where package_price is null or package_price <= 0) as missing_or_invalid_package_price,
  count(*) filter (where package_size is null or package_size <= 0) as missing_or_invalid_package_size,
  count(*) filter (where package_size is not null and package_unit is null) as package_size_without_unit,
  count(*) filter (
    where package_size is not null
      and package_unit is not null
      and package_unit <> default_unit
  ) as package_unit_differs_from_default_unit
from public.ingredients;

select
  count(*) as households,
  count(*) filter (where weekly_budget is not null) as households_with_weekly_budget
from public.households;

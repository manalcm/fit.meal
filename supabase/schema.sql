-- fitmeal — esquema inicial de base de datos (Fase 1)
-- Pega este archivo completo en Supabase: Dashboard > SQL Editor > New query > Run

-- ── Tipos ──────────────────────────────────────────────────────────────────

create type ingredient_category as enum (
  'verdura', 'fruta', 'carne', 'pescado', 'lacteo', 'huevo',
  'cereal_pan', 'legumbre', 'grasa_aceite', 'fruto_seco', 'bebida', 'otros'
);

create type ingredient_unit as enum ('gramos', 'unidad', 'ml');

-- Nota: se puede ampliar en el futuro con
-- ALTER TYPE meal_type ADD VALUE 'media_manana';
create type meal_type as enum ('desayuno', 'almuerzo', 'cena', 'snack');

-- ── Ingredientes (la base de todo) ───────────────────────────────────────────

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category ingredient_category not null default 'otros',
  kcal_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  price_per_kg numeric,
  default_unit ingredient_unit not null default 'gramos',
  grams_per_unit numeric,
  in_pantry boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Platos / recetas ─────────────────────────────────────────────────────────

create table meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_types meal_type[] not null default '{}',
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- ── Ingredientes de cada plato (la receta) ──────────────────────────────────

create table meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity_grams numeric not null check (quantity_grams > 0)
);

create index meal_ingredients_meal_id_idx on meal_ingredients(meal_id);

-- ── Personas (las 2 de la pareja) ────────────────────────────────────────────

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#22c55e',
  target_kcal numeric not null default 2000,
  target_protein numeric not null default 120,
  target_carbs numeric not null default 200,
  target_fat numeric not null default 60,
  target_water_ml numeric not null default 2000,
  created_at timestamptz not null default now()
);

-- ── Plan: qué come cada persona, cada día, en cada franja ───────────────────

create table plan_entries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  date date not null,
  meal_type meal_type not null,
  meal_id uuid not null references meals(id) on delete cascade,
  portion numeric check (portion > 0),
  override_grams numeric check (override_grams > 0),
  created_at timestamptz not null default now(),
  constraint portion_xor_override check (
    (portion is not null and override_grams is null) or
    (portion is null and override_grams is not null)
  )
);

create index plan_entries_person_date_idx on plan_entries(person_id, date);

-- ── Seguridad: RLS ───────────────────────────────────────────────────────────
-- La app es de un solo "hogar" compartido y todavía no tiene pantalla de login,
-- así que de momento se permite leer y escribir con la clave anon. Cuando se
-- añada el login por magic link, estas políticas deberían restringirse a
-- auth.role() = 'authenticated'.

alter table ingredients enable row level security;
alter table meals enable row level security;
alter table meal_ingredients enable row level security;
alter table people enable row level security;
alter table plan_entries enable row level security;

create policy "app_full_access" on ingredients for all using (true) with check (true);
create policy "app_full_access" on meals for all using (true) with check (true);
create policy "app_full_access" on meal_ingredients for all using (true) with check (true);
create policy "app_full_access" on people for all using (true) with check (true);
create policy "app_full_access" on plan_entries for all using (true) with check (true);

-- ── Storage: fotos de los platos ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', true)
  on conflict (id) do nothing;

create policy "meal_photos_read" on storage.objects for select using (bucket_id = 'meal-photos');
create policy "meal_photos_write" on storage.objects for insert with check (bucket_id = 'meal-photos');
create policy "meal_photos_update" on storage.objects for update using (bucket_id = 'meal-photos');
create policy "meal_photos_delete" on storage.objects for delete using (bucket_id = 'meal-photos');

-- ── Datos iniciales: las 2 personas ──────────────────────────────────────────
-- Ajusta nombres, colores y objetivos a tu gusto (o hazlo luego desde Ajustes).
insert into people (name, color, target_kcal, target_protein, target_carbs, target_fat, target_water_ml) values
  ('Persona 1', '#C1613A', 2200, 140, 220, 70, 2500),
  ('Persona 2', '#7E9468', 1800, 110, 180, 55, 2000);

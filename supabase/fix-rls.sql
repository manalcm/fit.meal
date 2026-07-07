-- Corrige el permiso demasiado estricto de la Fase 1: la app aún no tiene
-- pantalla de login, así que las políticas que exigían un usuario autenticado
-- bloqueaban también la escritura de datos (crear/editar/importar).
-- Esto permite leer y escribir con la clave anon mientras no haya login.

drop policy if exists "authenticated_full_access" on ingredients;
drop policy if exists "authenticated_full_access" on meals;
drop policy if exists "authenticated_full_access" on meal_ingredients;
drop policy if exists "authenticated_full_access" on people;
drop policy if exists "authenticated_full_access" on plan_entries;

create policy "app_full_access" on ingredients for all using (true) with check (true);
create policy "app_full_access" on meals for all using (true) with check (true);
create policy "app_full_access" on meal_ingredients for all using (true) with check (true);
create policy "app_full_access" on people for all using (true) with check (true);
create policy "app_full_access" on plan_entries for all using (true) with check (true);

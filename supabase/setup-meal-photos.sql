-- Fase 3: crea el almacén de fotos de los platos y permite subir/ver imágenes.

insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', true)
  on conflict (id) do nothing;

create policy "meal_photos_read" on storage.objects for select using (bucket_id = 'meal-photos');
create policy "meal_photos_write" on storage.objects for insert with check (bucket_id = 'meal-photos');
create policy "meal_photos_update" on storage.objects for update using (bucket_id = 'meal-photos');
create policy "meal_photos_delete" on storage.objects for delete using (bucket_id = 'meal-photos');

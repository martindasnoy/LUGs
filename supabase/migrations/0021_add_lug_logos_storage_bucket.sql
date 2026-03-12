insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lug-logos',
  'lug-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists lug_logos_public_read on storage.objects;
create policy lug_logos_public_read on storage.objects
for select
using (bucket_id = 'lug-logos');

drop policy if exists lug_logos_auth_insert on storage.objects;
create policy lug_logos_auth_insert on storage.objects
for insert
to authenticated
with check (bucket_id = 'lug-logos');

drop policy if exists lug_logos_auth_update on storage.objects;
create policy lug_logos_auth_update on storage.objects
for update
to authenticated
using (bucket_id = 'lug-logos')
with check (bucket_id = 'lug-logos');

drop policy if exists lug_logos_auth_delete on storage.objects;
create policy lug_logos_auth_delete on storage.objects
for delete
to authenticated
using (bucket_id = 'lug-logos');

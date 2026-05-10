-- Private bucket policies for symptom media uploads.
-- Bucket: symptom-media
-- Expected object path shape: <bunhouseId>/<bunnyId>/<fileId>.<ext>
--
-- Prefer applying `migrations/007_symptom_media_storage_policies.sql` via your migration runner
-- so policies stay in sync with the codebase. Alternatively, run this in the Supabase SQL Editor
-- AFTER creating the bucket (keep it private). Drop existing policies first if you hit "already exists".

-- Allow authenticated users to read symptom media for bunhouses they belong to
create policy "symptom media: select bunhouse"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'symptom-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to upload symptom media into bunhouse folders they belong to
create policy "symptom media: insert bunhouse"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'symptom-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to overwrite/update symptom media in their bunhouses
create policy "symptom media: update bunhouse"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'symptom-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'symptom-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete symptom media in their bunhouses
create policy "symptom media: delete bunhouse"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'symptom-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);


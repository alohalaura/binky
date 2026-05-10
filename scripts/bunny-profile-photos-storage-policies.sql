-- Private bucket policies for bunny profile photos.
-- Bucket: bunny-profile-photos
-- Expected object path shape: <bunhouseId>/<bunnyId>/profile.jpg
--
-- Run this in Supabase SQL Editor AFTER creating the bucket (keep it private).

-- Allow authenticated users to read bunhouse profile photos
create policy "bunny profile photos: select own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bunny-profile-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to upload into their bunhouse folder
create policy "bunny profile photos: insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bunny-profile-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to overwrite/update their bunhouse objects
create policy "bunny profile photos: update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'bunny-profile-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'bunny-profile-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their bunhouse objects
create policy "bunny profile photos: delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'bunny-profile-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);


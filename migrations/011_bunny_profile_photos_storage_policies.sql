-- RLS policies for private Storage bucket `bunny-profile-photos`.
-- Object path shape (see Settings.jsx / Onboarding): <bunhouseId>/<bunnyId>/profile.<ext>
-- Access: authenticated users who are members of that bunhouse (first path segment).
--
-- Requires bucket `bunny-profile-photos` (or your VITE_BUNNY_PROFILE_BUCKET name) — create in Dashboard → Storage.

drop policy if exists "bunny profile photos: select own" on storage.objects;
drop policy if exists "bunny profile photos: insert own" on storage.objects;
drop policy if exists "bunny profile photos: update own" on storage.objects;
drop policy if exists "bunny profile photos: delete own" on storage.objects;

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

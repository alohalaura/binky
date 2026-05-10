-- RLS policies for private Storage bucket `symptom-media`.
-- Object path shape (see SymptomLogger.jsx): <bunhouseId>/<bunnyId>/<fileId>.<ext>
-- Access: authenticated users who are members of the bunhouse (first path segment).
--
-- Requires bucket `symptom-media` to exist (private). Create it in Dashboard → Storage if needed.

drop policy if exists "symptom media: select bunhouse" on storage.objects;
drop policy if exists "symptom media: insert bunhouse" on storage.objects;
drop policy if exists "symptom media: update bunhouse" on storage.objects;
drop policy if exists "symptom media: delete bunhouse" on storage.objects;

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

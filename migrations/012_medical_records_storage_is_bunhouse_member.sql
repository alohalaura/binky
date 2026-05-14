-- Medical record file uploads hit storage.objects RLS. Policies that use
--   EXISTS (SELECT … FROM bunhouse_members …)
-- run that subquery as the authenticated user, so bunhouse_members RLS applies
-- and the check can fail even for valid members.
--
-- Use public.is_bunhouse_member (SECURITY DEFINER), same pattern as schema.sql
-- helper comment: "avoid RLS policy recursion".
--
-- Run once in Supabase SQL Editor.

drop policy if exists "medical records: select bunhouse" on storage.objects;
drop policy if exists "medical records: insert bunhouse" on storage.objects;
drop policy if exists "medical records: update bunhouse" on storage.objects;
drop policy if exists "medical records: delete bunhouse" on storage.objects;

create policy "medical records: select bunhouse"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'medical-records'
  and (
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
      then public.is_bunhouse_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

create policy "medical records: insert bunhouse"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'medical-records'
  and (
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
      then public.is_bunhouse_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

create policy "medical records: update bunhouse"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'medical-records'
  and (
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
      then public.is_bunhouse_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
)
with check (
  bucket_id = 'medical-records'
  and (
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
      then public.is_bunhouse_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

create policy "medical records: delete bunhouse"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'medical-records'
  and (
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
      then public.is_bunhouse_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  )
);

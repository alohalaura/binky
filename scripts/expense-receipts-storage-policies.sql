-- Private bucket policies for expense receipt uploads.
-- Bucket: expense-receipts
-- Expected object path shape: <bunhouseId>/<bunnyId>/<expenseId>/<fileId>.<ext>
--
-- Run this in Supabase SQL Editor AFTER creating the bucket (keep it private).

create policy "expense receipts: select bunhouse"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

create policy "expense receipts: insert bunhouse"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

create policy "expense receipts: update bunhouse"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);

create policy "expense receipts: delete bunhouse"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  and exists (
    select 1 from public.bunhouse_members m
    where m.bunhouse_id = ((storage.foldername(name))[1])::uuid
      and m.user_id = auth.uid()
  )
);


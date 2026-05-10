-- Run once in Supabase: SQL Editor → New query → paste → Run
-- Links weight logs to vet visits so editing a record updates the right weight entry.

alter table public.weight_logs
  add column if not exists source_record_id uuid references public.medical_records(id) on delete set null;

create unique index if not exists weight_logs_source_record_id_unique
  on public.weight_logs (source_record_id)
  where source_record_id is not null;


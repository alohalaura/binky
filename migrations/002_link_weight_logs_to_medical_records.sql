-- Run once in Supabase: SQL Editor → New query → paste → Run
-- Links weight logs to vet visits so editing a record updates the right weight entry.

alter table public.weight_logs
  add column if not exists source_record_id uuid references public.medical_records(id) on delete set null;

-- Must be a full unique index (not partial) so PostgREST upsert ON CONFLICT (source_record_id) works.
-- Multiple NULL source_record_id values are still allowed (PostgreSQL unique null semantics).
create unique index if not exists weight_logs_source_record_id_unique
  on public.weight_logs (source_record_id);


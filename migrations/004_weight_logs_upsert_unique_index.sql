-- Fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- when saving a vet visit with weight. PostgREST upsert uses ON CONFLICT (source_record_id),
-- which PostgreSQL cannot infer from a *partial* unique index.
--
-- Run in Supabase SQL Editor if you already applied 002 (partial index).

drop index if exists public.weight_logs_source_record_id_unique;

-- Non-partial unique index: still allows many rows with source_record_id IS NULL
-- (NULLs do not conflict in PostgreSQL unique indexes).
create unique index if not exists weight_logs_source_record_id_unique
  on public.weight_logs (source_record_id);

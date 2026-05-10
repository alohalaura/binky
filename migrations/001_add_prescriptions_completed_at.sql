-- Run once in Supabase: SQL Editor → New query → paste → Run
alter table public.prescriptions
  add column if not exists completed_at timestamptz;

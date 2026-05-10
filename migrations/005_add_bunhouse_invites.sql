-- Bunhouse invite-by-email

create extension if not exists "pgcrypto";

create table if not exists public.bunhouse_invites (
  id uuid primary key default gen_random_uuid(),
  bunhouse_id uuid not null references public.bunhouses(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists bunhouse_invites_bunhouse_email_uniq
  on public.bunhouse_invites (bunhouse_id, lower(email))
  where accepted_at is null;

alter table public.bunhouse_invites enable row level security;

-- Baseline PostgREST privileges (RLS still applies)
grant select, insert, update, delete on table public.bunhouse_invites to authenticated;


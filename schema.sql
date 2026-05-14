-- Binky Labs — Supabase schema (Spec v1.0)
-- Purpose: Core data model for rabbit profiles, health logs, medical records, and expenses.
-- Notes:
-- - All tables use UUID primary keys.
-- - Row Level Security (RLS) is enabled on every table.
-- - Ownership is enforced via profiles(id) (== auth.users.id) and bunnies.owner_id.

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles
-- One row per authenticated user (auth.users). Stores app-level user metadata.
-- Relationship: profiles.id == auth.users.id (1:1)
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- bunhouses
-- A shared workspace that can own many bunnies.
-- -----------------------------------------------------------------------------
create table if not exists bunhouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- bunhouse_members
-- Membership table linking authenticated users (profiles) to bunhouses.
-- -----------------------------------------------------------------------------
create table if not exists bunhouse_members (
  bunhouse_id uuid references bunhouses(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (bunhouse_id, user_id)
);

-- -----------------------------------------------------------------------------
-- bunhouse_invites
-- Invite-by-email workflow. Email is compared case-insensitively.
-- -----------------------------------------------------------------------------
create table if not exists bunhouse_invites (
  id uuid primary key default gen_random_uuid(),
  bunhouse_id uuid not null references bunhouses(id) on delete cascade,
  email text not null,
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  accepted_by uuid references profiles(id) on delete set null
);

create unique index if not exists bunhouse_invites_bunhouse_email_uniq
  on public.bunhouse_invites (bunhouse_id, lower(email))
  where accepted_at is null;

-- -----------------------------------------------------------------------------
-- bunnies
-- A user can create multiple bunny profiles. All bunny-owned records join through this table.
-- Relationship: bunnies.owner_id -> profiles.id (many:1)
-- -----------------------------------------------------------------------------
create table if not exists bunnies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  bunhouse_id uuid references bunhouses(id) on delete cascade,
  name text not null,
  breed text,
  date_of_birth date,
  sex text check (sex in ('male','female','unknown')),
  is_neutered boolean default false,
  favorite_snack text,
  favorite_hangout text,
  photo_url text,
  created_at timestamptz default now()
);

-- If `bunnies` already exists from an older migration, add bunhouse_id:
alter table public.bunnies add column if not exists bunhouse_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bunnies_bunhouse_id_fkey'
  ) then
    alter table public.bunnies
      add constraint bunnies_bunhouse_id_fkey
      foreign key (bunhouse_id) references public.bunhouses(id) on delete cascade;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- symptom_logs
-- Symptom entries for a bunny: what/where, severity, notes, and optional media.
-- Relationship: symptom_logs.bunny_id -> bunnies.id (many:1)
-- -----------------------------------------------------------------------------
create table if not exists symptom_logs (
  id uuid primary key default gen_random_uuid(),
  bunny_id uuid references bunnies(id) on delete cascade,
  logged_at timestamptz default now(),
  observed_since date,
  body_area text not null,
  symptom_type text not null,
  severity int check (severity between 1 and 5),
  notes text,
  media_urls text[],
  resolved boolean default false,
  resolved_at timestamptz
);

-- If you created `symptom_logs` before `observed_since` existed, run this once:
-- alter table public.symptom_logs add column if not exists observed_since date;

-- -----------------------------------------------------------------------------
-- medical_records
-- Vault of health documents and visit summaries for a bunny.
-- Relationship: medical_records.bunny_id -> bunnies.id (many:1)
-- Relationship: linked_visit_id self-references medical_records.id (optional link to a visit record)
-- -----------------------------------------------------------------------------
create table if not exists medical_records (
  id uuid primary key default gen_random_uuid(),
  bunny_id uuid references bunnies(id) on delete cascade,
  category text not null,
  -- categories: vet_visit | xray | blood_work | prescription
  -- vaccination | bill | fecal_test
  record_date date not null,
  title text,
  notes text,
  vet_name text,
  clinic_name text,
  file_urls text[],
  visit_type text check (visit_type is null or visit_type in ('physical', 'online')),
  visit_cost_amount numeric,
  visit_cost_currency text default 'PHP',
  linked_visit_id uuid references medical_records(id),
  created_at timestamptz default now()
);

-- If `medical_records` already exists from an older migration, add new columns:
alter table public.medical_records add column if not exists visit_type text;
alter table public.medical_records add column if not exists visit_cost_amount numeric;
alter table public.medical_records add column if not exists visit_cost_currency text;
alter table public.medical_records alter column visit_cost_currency set default 'PHP';

-- -----------------------------------------------------------------------------
-- medical_record_cost_items
-- Invoice-style line items for a visit/consult.
-- Relationship: medical_record_cost_items.medical_record_id -> medical_records.id (many:1)
-- -----------------------------------------------------------------------------
create table if not exists medical_record_cost_items (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid references medical_records(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- medical_record_files
-- One row per file attached to a visit (`medical_records`), with document type.
-- -----------------------------------------------------------------------------
create table if not exists medical_record_files (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid references medical_records(id) on delete cascade,
  storage_path text not null,
  file_kind text not null check (
    file_kind in ('xray', 'blood_work', 'prescription', 'vaccination', 'bill', 'fecal_test')
  ),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- prescriptions
-- Medication tracking for a bunny; can optionally link back to a medical record entry.
-- Relationship: prescriptions.bunny_id -> bunnies.id (many:1)
-- Relationship: prescriptions.record_id -> medical_records.id (optional, many:1)
-- -----------------------------------------------------------------------------
create table if not exists prescriptions (
  id uuid primary key default gen_random_uuid(),
  bunny_id uuid references bunnies(id) on delete cascade,
  drug_name text not null,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  prescribing_vet text,
  notes text,
  is_active boolean default true,
  completed_at timestamptz,
  record_id uuid references medical_records(id) on delete set null,
  created_at timestamptz default now()
);

-- If you created `prescriptions` before `completed_at` existed, run this once:
-- alter table public.prescriptions add column if not exists completed_at timestamptz;

-- -----------------------------------------------------------------------------
-- prescription_administrations
-- Daily checklist/history rows for medicine and vitamin doses.
-- Relationship: prescription_administrations.prescription_id -> prescriptions.id (many:1)
-- Relationship: prescription_administrations.bunny_id -> bunnies.id (many:1)
-- -----------------------------------------------------------------------------
create table if not exists prescription_administrations (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  bunny_id uuid not null references bunnies(id) on delete cascade,
  administered_on date not null default current_date,
  administered_at timestamptz not null default now(),
  created_at timestamptz default now(),
  unique (prescription_id, administered_on)
);

create index if not exists prescription_administrations_bunny_administered_at_idx
  on prescription_administrations (bunny_id, administered_at desc);

-- -----------------------------------------------------------------------------
-- weight_logs
-- Time series of bunny weight in grams for trend tracking.
-- Relationship: weight_logs.bunny_id -> bunnies.id (many:1)
-- -----------------------------------------------------------------------------
create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  bunny_id uuid references bunnies(id) on delete cascade,
  logged_at timestamptz default now(),
  weight_g numeric not null
);

-- -----------------------------------------------------------------------------
-- expenses
-- Cost tracking tied to a bunny; can optionally link a receipt and/or medical record.
-- Relationship: expenses.bunny_id -> bunnies.id (many:1)
-- Relationship: expenses.record_id -> medical_records.id (optional, many:1)
-- -----------------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  bunny_id uuid references bunnies(id) on delete cascade,
  expense_date date not null,
  category text,
  amount numeric not null,
  currency text default 'PHP',
  description text,
  receipt_urls text[],
  record_id uuid references medical_records(id) on delete set null,
  created_at timestamptz default now()
);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions (avoid RLS policy recursion)
-- -----------------------------------------------------------------------------
create or replace function public.is_bunhouse_member(target_bunhouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bunhouse_members m
    where m.bunhouse_id = target_bunhouse_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.auth_email()
returns text
language sql
stable
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$;

-- Enable RLS on every table
alter table profiles enable row level security;
alter table bunhouses enable row level security;
alter table bunhouse_members enable row level security;
alter table bunhouse_invites enable row level security;
alter table bunnies enable row level security;
alter table symptom_logs enable row level security;
alter table medical_records enable row level security;
alter table medical_record_cost_items enable row level security;
alter table medical_record_files enable row level security;
alter table prescriptions enable row level security;
alter table prescription_administrations enable row level security;
alter table weight_logs enable row level security;
alter table expenses enable row level security;

-- -----------------------------------------------------------------------------
-- profiles policies
-- Users can only read/write their own profile row (profiles.id == auth.uid()).
-- -----------------------------------------------------------------------------
drop policy if exists "profile_select" on profiles;
create policy "profile_select" on profiles
for select using (id = auth.uid());

drop policy if exists "profile_insert" on profiles;
create policy "profile_insert" on profiles
for insert with check (id = auth.uid());

drop policy if exists "profile_update" on profiles;
create policy "profile_update" on profiles
for update using (id = auth.uid());

drop policy if exists "profile_delete" on profiles;
create policy "profile_delete" on profiles
for delete using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- bunhouses policies
-- Any member can read/write their bunhouse.
-- -----------------------------------------------------------------------------
drop policy if exists "member_select" on bunhouses;
create policy "member_select" on bunhouses
for select using (
  public.is_bunhouse_member(bunhouses.id)
);

drop policy if exists "member_insert" on bunhouses;
create policy "member_insert" on bunhouses
for insert with check (true);

drop policy if exists "member_update" on bunhouses;
create policy "member_update" on bunhouses
for update using (
  public.is_bunhouse_member(bunhouses.id)
);

drop policy if exists "member_delete" on bunhouses;
create policy "member_delete" on bunhouses
for delete using (
  public.is_bunhouse_member(bunhouses.id)
);

-- -----------------------------------------------------------------------------
-- bunhouse_members policies
-- Members can read membership lists for their bunhouse.
-- Any member can add/remove members (all-edit model).
-- Additionally, a user can always insert a membership row for themselves (bootstrap).
-- -----------------------------------------------------------------------------
drop policy if exists "member_select" on bunhouse_members;
create policy "member_select" on bunhouse_members
for select using (
  public.is_bunhouse_member(bunhouse_members.bunhouse_id)
);

drop policy if exists "member_insert" on bunhouse_members;
create policy "member_insert" on bunhouse_members
for insert with check (
  bunhouse_members.user_id = auth.uid()
  or public.is_bunhouse_member(bunhouse_members.bunhouse_id)
);

drop policy if exists "member_update" on bunhouse_members;
create policy "member_update" on bunhouse_members
for update using (
  public.is_bunhouse_member(bunhouse_members.bunhouse_id)
);

drop policy if exists "member_delete" on bunhouse_members;
create policy "member_delete" on bunhouse_members
for delete using (
  public.is_bunhouse_member(bunhouse_members.bunhouse_id)
);

-- -----------------------------------------------------------------------------
-- bunhouse_invites policies
-- Members can manage invites for their bunhouse.
-- Invitees can read invites sent to their email and accept them.
-- -----------------------------------------------------------------------------
drop policy if exists "member_or_invitee_select" on bunhouse_invites;
create policy "member_or_invitee_select" on bunhouse_invites
for select using (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
  or (public.auth_email() is not null and lower(bunhouse_invites.email) = public.auth_email())
);

drop policy if exists "member_insert" on bunhouse_invites;
create policy "member_insert" on bunhouse_invites
for insert with check (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
);

drop policy if exists "member_delete" on bunhouse_invites;
create policy "member_delete" on bunhouse_invites
for delete using (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
);

drop policy if exists "invited_accept_update" on bunhouse_invites;
create policy "invited_accept_update" on bunhouse_invites
for update using (
  bunhouse_invites.accepted_at is null
  and public.auth_email() is not null
  and lower(bunhouse_invites.email) = public.auth_email()
)
with check (
  bunhouse_invites.accepted_at is not null
  and bunhouse_invites.accepted_by = auth.uid()
);

-- -----------------------------------------------------------------------------
-- bunnies policies
-- Users can only read/write bunnies for bunhouses they are a member of.
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on bunnies;
create policy "owner_select" on bunnies
for select using (
  bunhouse_id is not null
  and exists (
    select 1 from bunhouse_members m
    where m.bunhouse_id = bunnies.bunhouse_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "owner_insert" on bunnies;
create policy "owner_insert" on bunnies
for insert with check (
  bunhouse_id is not null
  and exists (
    select 1 from bunhouse_members m
    where m.bunhouse_id = bunnies.bunhouse_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "owner_update" on bunnies;
create policy "owner_update" on bunnies
for update using (
  bunhouse_id is not null
  and exists (
    select 1 from bunhouse_members m
    where m.bunhouse_id = bunnies.bunhouse_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "owner_delete" on bunnies;
create policy "owner_delete" on bunnies
for delete using (
  bunhouse_id is not null
  and exists (
    select 1 from bunhouse_members m
    where m.bunhouse_id = bunnies.bunhouse_id
      and m.user_id = auth.uid()
  )
);

-- Helper predicate pattern for bunny-owned tables:
-- Allow access only if the referenced bunny belongs to the current user.
-- exists (select 1 from bunnies b where b.id = <table>.bunny_id and b.owner_id = auth.uid())

-- -----------------------------------------------------------------------------
-- symptom_logs policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on symptom_logs;
create policy "owner_select" on symptom_logs
for select using (
  exists (
    select 1 from bunnies b
    where b.id = symptom_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on symptom_logs;
create policy "owner_insert" on symptom_logs
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = symptom_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on symptom_logs;
create policy "owner_update" on symptom_logs
for update using (
  exists (
    select 1 from bunnies b
    where b.id = symptom_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on symptom_logs;
create policy "owner_delete" on symptom_logs
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = symptom_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- medical_records policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on medical_records;
create policy "owner_select" on medical_records
for select using (
  exists (
    select 1 from bunnies b
    where b.id = medical_records.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on medical_records;
create policy "owner_insert" on medical_records
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = medical_records.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on medical_records;
create policy "owner_update" on medical_records
for update using (
  exists (
    select 1 from bunnies b
    where b.id = medical_records.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on medical_records;
create policy "owner_delete" on medical_records
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = medical_records.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- medical_record_cost_items policies (join via medical_record_id -> medical_records.bunny_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on medical_record_cost_items;
create policy "owner_select" on medical_record_cost_items
for select using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on medical_record_cost_items;
create policy "owner_insert" on medical_record_cost_items
for insert with check (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on medical_record_cost_items;
create policy "owner_update" on medical_record_cost_items
for update using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on medical_record_cost_items;
create policy "owner_delete" on medical_record_cost_items
for delete using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- medical_record_files policies (join via medical_record_id -> medical_records.bunny_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on medical_record_files;
create policy "owner_select" on medical_record_files
for select using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on medical_record_files;
create policy "owner_insert" on medical_record_files
for insert with check (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on medical_record_files;
create policy "owner_update" on medical_record_files
for update using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on medical_record_files;
create policy "owner_delete" on medical_record_files
for delete using (
  exists (
    select 1 from medical_records mr
    join bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- prescriptions policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on prescriptions;
create policy "owner_select" on prescriptions
for select using (
  exists (
    select 1 from bunnies b
    where b.id = prescriptions.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on prescriptions;
create policy "owner_insert" on prescriptions
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = prescriptions.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on prescriptions;
create policy "owner_update" on prescriptions
for update using (
  exists (
    select 1 from bunnies b
    where b.id = prescriptions.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on prescriptions;
create policy "owner_delete" on prescriptions
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = prescriptions.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- prescription_administrations policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on prescription_administrations;
create policy "owner_select" on prescription_administrations
for select using (
  exists (
    select 1 from bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on prescription_administrations;
create policy "owner_insert" on prescription_administrations
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on prescription_administrations;
create policy "owner_update" on prescription_administrations
for update using (
  exists (
    select 1 from bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on prescription_administrations;
create policy "owner_delete" on prescription_administrations
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- weight_logs policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on weight_logs;
create policy "owner_select" on weight_logs
for select using (
  exists (
    select 1 from bunnies b
    where b.id = weight_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on weight_logs;
create policy "owner_insert" on weight_logs
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = weight_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on weight_logs;
create policy "owner_update" on weight_logs
for update using (
  exists (
    select 1 from bunnies b
    where b.id = weight_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on weight_logs;
create policy "owner_delete" on weight_logs
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = weight_logs.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- expenses policies (join via bunny_id -> bunnies.owner_id)
-- -----------------------------------------------------------------------------
drop policy if exists "owner_select" on expenses;
create policy "owner_select" on expenses
for select using (
  exists (
    select 1 from bunnies b
    where b.id = expenses.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on expenses;
create policy "owner_insert" on expenses
for insert with check (
  exists (
    select 1 from bunnies b
    where b.id = expenses.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on expenses;
create policy "owner_update" on expenses
for update using (
  exists (
    select 1 from bunnies b
    where b.id = expenses.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on expenses;
create policy "owner_delete" on expenses
for delete using (
  exists (
    select 1 from bunnies b
    where b.id = expenses.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- =============================================================================
-- Auth triggers
-- =============================================================================

-- Auto-create a profiles row whenever a new auth.users row is created.
-- This keeps profiles(id) in sync with auth.users(id).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =============================================================================
-- Privileges (PostgREST)
-- =============================================================================
-- Supabase clients use the "anon" key + an authenticated JWT.
-- RLS policies control *which rows* can be accessed, but the roles also need
-- table privileges to use PostgREST.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.bunhouses,
  public.bunhouse_members,
  public.bunhouse_invites,
  public.bunnies,
  public.symptom_logs,
  public.medical_records,
  public.medical_record_cost_items,
  public.medical_record_files,
  public.prescriptions,
  public.prescription_administrations,
  public.weight_logs,
  public.expenses
to authenticated;

-- Ensure future tables also have baseline privileges (RLS still applies).
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

